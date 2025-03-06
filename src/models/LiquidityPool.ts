import { Token } from "./Token";
import { PriceCalculator } from "./PriceCalculator";

export interface LPPosition {
  id: string;
  owner: string;
  liquidity: number;
  lowerPriceBound: number; // Pa
  upperPriceBound: number; // Pb
  collateralAmount: number;
  initialPreTokenAmount: number;
}

export class LiquidityPool {
  private _baseToken: Token;
  private _preToken: Token;
  private _baseReserve: number = 0;
  private _preTokenReserve: number = 0;
  private _minPrice: number; // Pa
  private _maxPrice: number; // Pb
  private _liquidity: number = 0;
  private _lpPositions: Map<string, LPPosition> = new Map();
  private _priceCalculator: PriceCalculator;
  private _feePercentage: number = 0.003; // 0.3%
  private _isSettlementPhase: boolean = false;
  private _realToken: Token | null = null;
  private _nextPositionId: number = 1;
  private _currentSqrtPrice: number; // Lưu trữ căn bậc hai của giá hiện tại
  private _initialPriceSet: boolean = false; // Đánh dấu đã thiết lập giá khởi đầu chưa

  constructor(
    baseToken: Token,
    preToken: Token,
    minPrice: number,
    maxPrice: number,
    initialPrice?: number
  ) {
    this._baseToken = baseToken;
    this._preToken = preToken;
    this._minPrice = minPrice;
    this._maxPrice = maxPrice;
    this._priceCalculator = new PriceCalculator();

    // Thiết lập giá khởi đầu
    if (initialPrice && initialPrice >= minPrice && initialPrice <= maxPrice) {
      this._currentSqrtPrice = Math.sqrt(initialPrice);
      this._initialPriceSet = true;
    } else {
      // Mặc định sử dụng giá thấp nhất nếu không có giá khởi đầu được chỉ định
      this._currentSqrtPrice = Math.sqrt(minPrice);
      this._initialPriceSet = true;
    }
  }

  get baseToken(): Token {
    return this._baseToken;
  }

  get preToken(): Token {
    return this._preToken;
  }

  get baseReserve(): number {
    return this._baseReserve;
  }

  get preTokenReserve(): number {
    return this._preTokenReserve;
  }

  get minPrice(): number {
    return this._minPrice;
  }

  get maxPrice(): number {
    return this._maxPrice;
  }

  get liquidity(): number {
    return this._liquidity;
  }

  get isSettlementPhase(): boolean {
    return this._isSettlementPhase;
  }

  get realToken(): Token | null {
    return this._realToken;
  }

  /**
   * Lấy giá hiện tại của pool
   * Trong Uniswap V3, giá hiện tại không phụ thuộc trực tiếp vào tỷ lệ token trong pool
   * mà phản ánh vùng thanh khoản đang hoạt động
   */
  getCurrentPrice(): number {
    return this._currentSqrtPrice * this._currentSqrtPrice;
  }

  /**
   * Add liquidity to the pool
   * @param owner LP provider address
   * @param baseAmount Amount of base token to add
   * @param pa Minimum price
   * @param pb Maximum price
   * @returns LP position ID
   */
  addLiquidity(
    owner: string,
    baseAmount: number,
    pa: number,
    pb: number
  ): string {
    if (this._isSettlementPhase) {
      throw new Error("Cannot add liquidity during settlement phase");
    }

    if (baseAmount <= 0) {
      throw new Error("Base amount must be positive");
    }

    // Check if the LP provider has enough base tokens
    const lpBaseBalance = this._baseToken.balanceOf(owner);
    if (lpBaseBalance < baseAmount * 2) {
      // Need baseAmount for liquidity + baseAmount for collateral
      throw new Error(
        `Insufficient balance: need ${baseAmount * 2} ${
          this._baseToken.symbol
        } (${baseAmount} for liquidity + ${baseAmount} for collateral), but only have ${lpBaseBalance}`
      );
    }

    // Calculate pre-token amount based on the formula
    const preTokenAmount = this._priceCalculator.calculatePreTokenAmount(
      baseAmount,
      pa,
      pb
    );

    // Calculate liquidity
    const liquidityAmount = this._priceCalculator.calculateLiquidity(
      baseAmount,
      pa,
      pb
    );

    // Transfer base tokens from LP provider to pool (both for liquidity and collateral)
    this._baseToken.transfer(owner, "POOL", baseAmount * 2);

    // Update reserves
    this._baseReserve += baseAmount;
    this._preTokenReserve += preTokenAmount;
    this._liquidity += liquidityAmount;

    // Mint pre-tokens (in a real implementation, this would be done by a separate contract)
    this._preToken.mint("POOL", preTokenAmount);

    // Create LP position
    const positionId = `LP-${this._nextPositionId++}`;
    const position: LPPosition = {
      id: positionId,
      owner,
      liquidity: liquidityAmount,
      lowerPriceBound: pa,
      upperPriceBound: pb,
      collateralAmount: baseAmount, // Equal collateral to base token
      initialPreTokenAmount: preTokenAmount,
    };

    this._lpPositions.set(positionId, position);

    // Trong Uniswap V3, thêm thanh khoản không làm thay đổi giá hiện tại
    // Nếu chưa có giá khởi đầu và đây là LP đầu tiên, thiết lập giá khởi đầu
    if (!this._initialPriceSet && this._lpPositions.size === 1) {
      // Sử dụng giá thấp nhất của vùng thanh khoản đầu tiên
      this._currentSqrtPrice = Math.sqrt(pa);
      this._initialPriceSet = true;
    }

    console.log(`
LP Provider ${owner} added liquidity:
- Base Token: ${baseAmount} ${this._baseToken.symbol}
- Pre-Token Minted: ${preTokenAmount.toFixed(6)} ${this._preToken.symbol}
- Collateral: ${baseAmount} ${this._baseToken.symbol}
- Price Range: ${pa} - ${pb}
- Position ID: ${positionId}
- Current Pool Price: ${this.getCurrentPrice().toFixed(6)}
    `);

    return positionId;
  }

  /**
   * Swap base token for pre-token
   * @param trader Trader address
   * @param baseAmount Amount of base token to swap
   * @returns Amount of pre-token received
   */
  swapBaseForPreToken(trader: string, baseAmount: number): number {
    if (this._isSettlementPhase) {
      throw new Error("Cannot swap during settlement phase");
    }

    if (baseAmount <= 0) {
      throw new Error("Base amount must be positive");
    }

    // Check if trader has enough base tokens
    const traderBaseBalance = this._baseToken.balanceOf(trader);
    if (traderBaseBalance < baseAmount) {
      throw new Error(
        `Insufficient balance: need ${baseAmount} ${this._baseToken.symbol}, but only have ${traderBaseBalance}`
      );
    }

    // Calculate fee
    const fee = baseAmount * this._feePercentage;
    const baseAmountAfterFee = baseAmount - fee;

    // Calculate output amount
    const outputAmount = this._priceCalculator.calculateSwapOutput(
      baseAmountAfterFee,
      this._baseReserve,
      this._preTokenReserve,
      this._minPrice,
      this._maxPrice,
      true // base to pre-token
    );

    if (outputAmount <= 0) {
      throw new Error("Insufficient output amount");
    }

    // Transfer base tokens from trader to pool
    this._baseToken.transfer(trader, "POOL", baseAmount);

    // Update reserves
    this._baseReserve += baseAmountAfterFee;
    this._preTokenReserve -= outputAmount;

    // Transfer pre-tokens from pool to trader
    this._preToken.transfer("POOL", trader, outputAmount);

    const oldPrice = this.getCurrentPrice();

    // Cập nhật giá hiện tại sau khi giao dịch
    // Trong Uniswap V3, giá hiện tại thay đổi khi có giao dịch
    // Tính toán giá mới dựa trên tỷ lệ reserves sau giao dịch
    if (this._preTokenReserve > 0 && this._baseReserve > 0) {
      const newPrice = this._priceCalculator.calculateCurrentPrice(
        this._baseReserve,
        this._preTokenReserve,
        this._minPrice,
        this._maxPrice
      );
      this._currentSqrtPrice = Math.sqrt(newPrice);
    }

    console.log(`
Trader ${trader} swapped base token for pre-token:
- Input: ${baseAmount} ${this._baseToken.symbol}
- Fee: ${fee.toFixed(6)} ${this._baseToken.symbol}
- Output: ${outputAmount.toFixed(6)} ${this._preToken.symbol}
- New Pool Price: ${this.getCurrentPrice().toFixed(6)}
- Price Impact: ${((this.getCurrentPrice() / oldPrice - 1) * 100).toFixed(2)}%
    `);

    return outputAmount;
  }

  /**
   * Swap pre-token for base token
   * @param trader Trader address
   * @param preTokenAmount Amount of pre-token to swap
   * @returns Amount of base token received
   */
  swapPreTokenForBase(trader: string, preTokenAmount: number): number {
    if (this._isSettlementPhase) {
      throw new Error("Cannot swap during settlement phase");
    }

    if (preTokenAmount <= 0) {
      throw new Error("Pre-token amount must be positive");
    }

    // Check if trader has enough pre-tokens
    const traderPreTokenBalance = this._preToken.balanceOf(trader);
    if (traderPreTokenBalance < preTokenAmount) {
      throw new Error(
        `Insufficient balance: need ${preTokenAmount} ${this._preToken.symbol}, but only have ${traderPreTokenBalance}`
      );
    }

    // Calculate output amount
    const outputAmount = this._priceCalculator.calculateSwapOutput(
      preTokenAmount,
      this._preTokenReserve,
      this._baseReserve,
      this._minPrice,
      this._maxPrice,
      false // pre-token to base
    );

    if (outputAmount <= 0) {
      throw new Error("Insufficient output amount");
    }

    // Calculate fee
    const fee = outputAmount * this._feePercentage;
    const outputAmountAfterFee = outputAmount - fee;

    // Transfer pre-tokens from trader to pool
    this._preToken.transfer(trader, "POOL", preTokenAmount);

    // Update reserves
    this._preTokenReserve += preTokenAmount;
    this._baseReserve -= outputAmount;

    // Transfer base tokens from pool to trader
    this._baseToken.transfer("POOL", trader, outputAmountAfterFee);

    const oldPrice = this.getCurrentPrice();

    // Cập nhật giá hiện tại sau khi giao dịch
    // Trong Uniswap V3, giá hiện tại thay đổi khi có giao dịch
    // Tính toán giá mới dựa trên tỷ lệ reserves sau giao dịch
    if (this._preTokenReserve > 0 && this._baseReserve > 0) {
      const newPrice = this._priceCalculator.calculateCurrentPrice(
        this._baseReserve,
        this._preTokenReserve,
        this._minPrice,
        this._maxPrice
      );
      this._currentSqrtPrice = Math.sqrt(newPrice);
    }

    console.log(`
Trader ${trader} swapped pre-token for base token:
- Input: ${preTokenAmount.toFixed(6)} ${this._preToken.symbol}
- Output: ${outputAmountAfterFee.toFixed(6)} ${this._baseToken.symbol}
- Fee: ${fee.toFixed(6)} ${this._baseToken.symbol}
- New Pool Price: ${this.getCurrentPrice().toFixed(6)}
- Price Impact: ${((this.getCurrentPrice() / oldPrice - 1) * 100).toFixed(2)}%
    `);

    return outputAmountAfterFee;
  }

  /**
   * Get LP position details
   * @param positionId LP position ID
   * @returns LP position details
   */
  getLPPosition(positionId: string): LPPosition | undefined {
    return this._lpPositions.get(positionId);
  }

  /**
   * Get all LP positions
   * @returns All LP positions
   */
  getAllLPPositions(): LPPosition[] {
    return Array.from(this._lpPositions.values());
  }

  /**
   * Enter settlement phase
   * @param realToken Real token to be used in settlement
   */
  enterSettlementPhase(realToken: Token): void {
    if (this._isSettlementPhase) {
      throw new Error("Already in settlement phase");
    }

    this._isSettlementPhase = true;
    this._realToken = realToken;

    console.log(`
Pool entered settlement phase:
- Real Token: ${realToken.symbol}
- Pre-Token Reserve: ${this._preTokenReserve.toFixed(6)} ${
      this._preToken.symbol
    }
- Base Token Reserve: ${this._baseReserve.toFixed(6)} ${this._baseToken.symbol}
    `);
  }
}
