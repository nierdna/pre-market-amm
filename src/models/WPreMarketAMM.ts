import { Token } from "./Token";
import { LiquidityPool } from "./LiquidityPool";

export class WPreMarketAMM {
  private _liquidityPools: Map<string, LiquidityPool> = new Map();
  private _isSettlementPhase: boolean = false;

  /**
   * Create a new liquidity pool
   * @param baseToken Base token (e.g., ETH, USDC)
   * @param preToken Pre-token
   * @param minPrice Minimum price (Pa)
   * @param maxPrice Maximum price (Pb)
   * @returns Pool ID
   */
  createPool(
    baseToken: Token,
    preToken: Token,
    minPrice: number,
    maxPrice: number
  ): string {
    const poolId = `${baseToken.symbol}-${preToken.symbol}`;

    if (this._liquidityPools.has(poolId)) {
      throw new Error(`Pool ${poolId} already exists`);
    }

    const pool = new LiquidityPool(baseToken, preToken, minPrice, maxPrice);
    this._liquidityPools.set(poolId, pool);

    console.log(
      `Created new pool: ${poolId} with price range ${minPrice} - ${maxPrice}`
    );

    return poolId;
  }

  /**
   * Get a liquidity pool
   * @param poolId Pool ID
   * @returns Liquidity pool
   */
  getPool(poolId: string): LiquidityPool {
    const pool = this._liquidityPools.get(poolId);

    if (!pool) {
      throw new Error(`Pool ${poolId} does not exist`);
    }

    return pool;
  }

  /**
   * Add liquidity to a pool
   * @param poolId Pool ID
   * @param lpProvider LP provider address
   * @param baseAmount Base token amount
   * @param minPrice Minimum price (Pa)
   * @param maxPrice Maximum price (Pb)
   * @returns LP position ID
   */
  addLiquidity(
    poolId: string,
    lpProvider: string,
    baseAmount: number,
    minPrice: number,
    maxPrice: number
  ): string {
    const pool = this.getPool(poolId);
    return pool.addLiquidity(lpProvider, baseAmount, minPrice, maxPrice);
  }

  /**
   * Swap base token for pre-token
   * @param poolId Pool ID
   * @param trader Trader address
   * @param baseAmount Base token amount
   * @returns Pre-token amount received
   */
  swapBaseForPreToken(
    poolId: string,
    trader: string,
    baseAmount: number
  ): number {
    const pool = this.getPool(poolId);
    return pool.swapBaseForPreToken(trader, baseAmount);
  }

  /**
   * Swap pre-token for base token
   * @param poolId Pool ID
   * @param trader Trader address
   * @param preTokenAmount Pre-token amount
   * @returns Base token amount received
   */
  swapPreTokenForBase(
    poolId: string,
    trader: string,
    preTokenAmount: number
  ): number {
    const pool = this.getPool(poolId);
    return pool.swapPreTokenForBase(trader, preTokenAmount);
  }

  /**
   * Get the current price of a pool
   * @param poolId Pool ID
   * @returns Current price
   */
  getPrice(poolId: string): number {
    const pool = this.getPool(poolId);
    return pool.getCurrentPrice();
  }

  /**
   * Enter settlement phase for a pool
   * @param poolId Pool ID
   * @param realToken Real token to be used in settlement
   */
  enterSettlementPhase(poolId: string, realToken: Token): void {
    const pool = this.getPool(poolId);
    pool.enterSettlementPhase(realToken);
    this._isSettlementPhase = true;
  }

  /**
   * Get all pools
   * @returns All pools
   */
  getAllPools(): Map<string, LiquidityPool> {
    return this._liquidityPools;
  }
}
