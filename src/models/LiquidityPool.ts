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
  private _liquidity: number = 0;
  private _lpPositions: Map<string, LPPosition> = new Map();
  private _priceCalculator: PriceCalculator;
  private _feePercentage: number = 0.003; // 0.3%
  private _isSettlementPhase: boolean = false;
  private _realToken: Token | null = null;
  private _nextPositionId: number = 1;
  private _currentSqrtPrice: number; // Lưu trữ căn bậc hai của giá hiện tại
  private _initialPriceSet: boolean = false; // Đánh dấu đã thiết lập giá khởi đầu chưa

  constructor(baseToken: Token, preToken: Token, initialPrice?: number) {
    this._baseToken = baseToken;
    this._preToken = preToken;
    this._priceCalculator = new PriceCalculator();
    this._currentSqrtPrice = initialPrice ? Math.sqrt(initialPrice) : 0;
    this._initialPriceSet = initialPrice !== undefined;
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
   * Swap base token for pre-token (mua pre-token bằng base token)
   * Cập nhật theo cơ chế Uniswap V3 - xử lý giao dịch qua nhiều khoảng giá
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

    // Transfer base tokens from trader to pool
    this._baseToken.transfer(trader, "POOL", baseAmount);

    // Lấy giá hiện tại
    const currentPrice = this.getCurrentPrice();
    const currentSqrtPrice = Math.sqrt(currentPrice);

    // Lấy danh sách các vị thế LP được sắp xếp theo giá tăng dần
    const positions = Array.from(this._lpPositions.values()).sort(
      (a, b) => a.lowerPriceBound - b.lowerPriceBound
    );

    // Tìm vị thế LP đầu tiên có khoảng giá chứa giá hiện tại
    let currentPositionIndex = positions.findIndex(
      (pos) =>
        pos.lowerPriceBound <= currentPrice &&
        pos.upperPriceBound >= currentPrice
    );

    if (currentPositionIndex === -1) {
      // Nếu không tìm thấy vị thế nào chứa giá hiện tại, tìm vị thế gần nhất có giá cao hơn
      currentPositionIndex = positions.findIndex(
        (pos) => pos.lowerPriceBound > currentPrice
      );

      if (currentPositionIndex === -1) {
        throw new Error("No liquidity available at current price or higher");
      }
    }

    let remainingBaseAmount = baseAmountAfterFee;
    let totalPreTokenOutput = 0;
    let newSqrtPrice = currentSqrtPrice;

    console.log(`
Swap details (Base token to Pre-token):
- Starting price: ${currentPrice.toFixed(6)}
- Base amount after fee: ${baseAmountAfterFee.toFixed(6)} ${
      this._baseToken.symbol
    }
    `);

    // Xử lý giao dịch qua các khoảng giá
    while (remainingBaseAmount > 0 && currentPositionIndex < positions.length) {
      const position = positions[currentPositionIndex];

      // Tính toán thanh khoản hiệu quả cho vị thế này
      const liquidity = position.liquidity;

      // Xác định giới hạn giá của khoảng hiện tại
      const lowerSqrtPrice = Math.sqrt(position.lowerPriceBound);
      const upperSqrtPrice = Math.sqrt(position.upperPriceBound);

      // Đảm bảo newSqrtPrice không thấp hơn lowerSqrtPrice
      if (newSqrtPrice < lowerSqrtPrice) {
        newSqrtPrice = lowerSqrtPrice;
      }

      // Tính toán giá mới dựa trên lượng base token còn lại và thanh khoản
      // Công thức: √P_new = √P_current + Δy / L
      const maxNewSqrtPrice = newSqrtPrice + remainingBaseAmount / liquidity;

      // Giới hạn giá mới không vượt quá upperSqrtPrice
      const effectiveNewSqrtPrice = Math.min(maxNewSqrtPrice, upperSqrtPrice);

      // Tính lượng base token được sử dụng trong khoảng giá này
      // Công thức: Δy = L * (√P_new - √P_current)
      const baseAmountUsed = liquidity * (effectiveNewSqrtPrice - newSqrtPrice);

      // Tính lượng pre-token nhận được trong khoảng giá này
      // Công thức: Δx = L * (1/√P_current - 1/√P_new)
      const preTokenReceived =
        liquidity * (1 / newSqrtPrice - 1 / effectiveNewSqrtPrice);

      // Cập nhật giá mới
      newSqrtPrice = effectiveNewSqrtPrice;

      // Cập nhật số lượng còn lại và tổng output
      remainingBaseAmount -= baseAmountUsed;
      totalPreTokenOutput += preTokenReceived;

      console.log(`
Processing price range [${position.lowerPriceBound.toFixed(
        6
      )}, ${position.upperPriceBound.toFixed(6)}]:
- Liquidity: ${liquidity.toFixed(6)}
- Base token used: ${baseAmountUsed.toFixed(6)} ${this._baseToken.symbol}
- Pre-token received: ${preTokenReceived.toFixed(6)} ${this._preToken.symbol}
- New price: ${(newSqrtPrice * newSqrtPrice).toFixed(6)}
      `);

      // Nếu chưa sử dụng hết khoảng giá hiện tại, dừng vòng lặp
      if (effectiveNewSqrtPrice < upperSqrtPrice) {
        break;
      }

      // Di chuyển đến khoảng giá tiếp theo
      currentPositionIndex++;
    }

    // Nếu vẫn còn base token chưa sử dụng, trả lại cho trader
    if (remainingBaseAmount > 0) {
      this._baseToken.transfer("POOL", trader, remainingBaseAmount);
      console.log(
        `Returning unused base token: ${remainingBaseAmount.toFixed(6)} ${
          this._baseToken.symbol
        }`
      );
    }

    // Cập nhật reserves
    this._baseReserve += baseAmountAfterFee - remainingBaseAmount;
    this._preTokenReserve -= totalPreTokenOutput;

    // Cập nhật giá hiện tại
    this._currentSqrtPrice = newSqrtPrice;

    // Transfer pre-tokens từ pool đến trader
    this._preToken.transfer("POOL", trader, totalPreTokenOutput);

    const oldPrice = currentPrice;
    const newPrice = newSqrtPrice * newSqrtPrice;

    console.log(`
Trader ${trader} swapped base token for pre-token:
- Input: ${baseAmount} ${this._baseToken.symbol}
- Fee: ${fee.toFixed(6)} ${this._baseToken.symbol}
- Output: ${totalPreTokenOutput.toFixed(6)} ${this._preToken.symbol}
- Starting Price: $${oldPrice.toFixed(6)}
- New Pool Price: $${newPrice.toFixed(6)}
- Price Impact: ${((newPrice / oldPrice - 1) * 100).toFixed(2)}%
    `);

    return totalPreTokenOutput;
  }

  /**
   * Swap pre-token for base token (bán pre-token để lấy base token)
   * Cập nhật theo cơ chế Uniswap V3 - xử lý giao dịch qua nhiều khoảng giá
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

    // Transfer pre-tokens from trader to pool
    this._preToken.transfer(trader, "POOL", preTokenAmount);

    // Lấy giá hiện tại
    const currentPrice = this.getCurrentPrice();
    const currentSqrtPrice = Math.sqrt(currentPrice);

    // Lấy danh sách các vị thế LP được sắp xếp theo giá giảm dần (ngược với swapBaseForPreToken)
    const positions = Array.from(this._lpPositions.values()).sort(
      (a, b) => b.upperPriceBound - a.upperPriceBound
    );

    // Tìm vị thế LP đầu tiên có khoảng giá chứa giá hiện tại
    let currentPositionIndex = positions.findIndex(
      (pos) =>
        pos.lowerPriceBound <= currentPrice &&
        pos.upperPriceBound >= currentPrice
    );

    if (currentPositionIndex === -1) {
      // Nếu không tìm thấy vị thế nào chứa giá hiện tại, tìm vị thế gần nhất có giá thấp hơn
      currentPositionIndex = positions.findIndex(
        (pos) => pos.upperPriceBound < currentPrice
      );

      if (currentPositionIndex === -1) {
        throw new Error("No liquidity available at current price or lower");
      }
    }

    let remainingPreTokenAmount = preTokenAmount;
    let totalBaseTokenOutput = 0;
    let newSqrtPrice = currentSqrtPrice;

    console.log(`
Swap details (Pre-token to Base token):
- Starting price: ${currentPrice.toFixed(6)}
- Pre-token amount: ${preTokenAmount.toFixed(6)} ${this._preToken.symbol}
    `);

    // Xử lý giao dịch qua các khoảng giá
    while (
      remainingPreTokenAmount > 0 &&
      currentPositionIndex < positions.length
    ) {
      const position = positions[currentPositionIndex];

      // Tính toán thanh khoản hiệu quả cho vị thế này
      const liquidity = position.liquidity;

      // Xác định giới hạn giá của khoảng hiện tại
      const lowerSqrtPrice = Math.sqrt(position.lowerPriceBound);
      const upperSqrtPrice = Math.sqrt(position.upperPriceBound);

      // Đảm bảo newSqrtPrice không cao hơn upperSqrtPrice
      if (newSqrtPrice > upperSqrtPrice) {
        newSqrtPrice = upperSqrtPrice;
      }

      // Tính toán giá mới dựa trên lượng pre-token còn lại và thanh khoản
      // Khi bán pre-token, giá giảm
      // Công thức: Δx = L * (1/√P_new - 1/√P_current)
      // Giải cho √P_new: √P_new = 1 / (Δx/L + 1/√P_current)
      const divisor = remainingPreTokenAmount / liquidity + 1 / newSqrtPrice;
      const minNewSqrtPrice = divisor > 0 ? 1 / divisor : 0;

      // Giới hạn giá mới không thấp hơn lowerSqrtPrice
      const effectiveNewSqrtPrice = Math.max(minNewSqrtPrice, lowerSqrtPrice);

      // Tính lượng pre-token được sử dụng trong khoảng giá này
      // Công thức: Δx = L * (1/√P_current - 1/√P_new)
      const preTokenUsed =
        liquidity * (1 / newSqrtPrice - 1 / effectiveNewSqrtPrice);

      // Tính lượng base token nhận được trong khoảng giá này
      // Công thức: Δy = L * (√P_current - √P_new)
      const baseTokenReceived =
        liquidity * (newSqrtPrice - effectiveNewSqrtPrice);

      // Cập nhật giá mới
      newSqrtPrice = effectiveNewSqrtPrice;

      // Cập nhật số lượng còn lại và tổng output
      remainingPreTokenAmount -= preTokenUsed;
      totalBaseTokenOutput += baseTokenReceived;

      console.log(`
Processing price range [${position.lowerPriceBound.toFixed(
        6
      )}, ${position.upperPriceBound.toFixed(6)}]:
- Liquidity: ${liquidity.toFixed(6)}
- Pre-token used: ${preTokenUsed.toFixed(6)} ${this._preToken.symbol}
- Base token received: ${baseTokenReceived.toFixed(6)} ${this._baseToken.symbol}
- New price: ${(newSqrtPrice * newSqrtPrice).toFixed(6)}
      `);

      // Nếu chưa sử dụng hết khoảng giá hiện tại, dừng vòng lặp
      if (effectiveNewSqrtPrice > lowerSqrtPrice) {
        break;
      }

      // Di chuyển đến khoảng giá tiếp theo
      currentPositionIndex++;
    }

    // Nếu vẫn còn pre-token chưa sử dụng, trả lại cho trader
    if (remainingPreTokenAmount > 0) {
      this._preToken.transfer("POOL", trader, remainingPreTokenAmount);
      console.log(
        `Returning unused pre-token: ${remainingPreTokenAmount.toFixed(6)} ${
          this._preToken.symbol
        }`
      );
    }

    // Tính phí
    const fee = totalBaseTokenOutput * this._feePercentage;
    const baseTokenOutputAfterFee = totalBaseTokenOutput - fee;

    // Cập nhật reserves
    this._preTokenReserve += preTokenAmount - remainingPreTokenAmount;
    this._baseReserve -= totalBaseTokenOutput;

    // Cập nhật giá hiện tại
    this._currentSqrtPrice = newSqrtPrice;

    // Transfer base tokens từ pool đến trader
    this._baseToken.transfer("POOL", trader, baseTokenOutputAfterFee);

    const oldPrice = currentPrice;
    const newPrice = newSqrtPrice * newSqrtPrice;

    console.log(`
Trader ${trader} swapped pre-token for base token:
- Input: ${preTokenAmount.toFixed(6)} ${this._preToken.symbol}
- Output: ${baseTokenOutputAfterFee.toFixed(6)} ${this._baseToken.symbol}
- Fee: ${fee.toFixed(6)} ${this._baseToken.symbol}
- Starting Price: $${oldPrice.toFixed(6)}
- New Pool Price: $${newPrice.toFixed(6)}
- Price Impact: ${((newPrice / oldPrice - 1) * 100).toFixed(2)}%
    `);

    return baseTokenOutputAfterFee;
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
