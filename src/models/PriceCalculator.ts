export class PriceCalculator {
  /**
   * Calculate liquidity based on the formula: L = x / (1/√Pa - 1/√Pb)
   * @param x Amount of base token
   * @param pa Minimum price
   * @param pb Maximum price
   * @returns Liquidity value
   */
  calculateLiquidity(x: number, pa: number, pb: number): number {
    if (pa >= pb || pa <= 0 || pb <= 0) {
      throw new Error(
        "Invalid price range: Pa must be less than Pb and both must be positive"
      );
    }

    const sqrtPa = Math.sqrt(pa);
    const sqrtPb = Math.sqrt(pb);

    return x / (1 / sqrtPa - 1 / sqrtPb);
  }

  /**
   * Calculate pre-token amount based on the formula: y = x · (√Pb - √Pa) / (1/√Pa - 1/√Pb)
   * @param x Amount of base token
   * @param pa Minimum price
   * @param pb Maximum price
   * @returns Amount of pre-token
   */
  calculatePreTokenAmount(x: number, pa: number, pb: number): number {
    if (pa >= pb || pa <= 0 || pb <= 0) {
      throw new Error(
        "Invalid price range: Pa must be less than Pb and both must be positive"
      );
    }

    const sqrtPa = Math.sqrt(pa);
    const sqrtPb = Math.sqrt(pb);

    return (x * (sqrtPb - sqrtPa)) / (1 / sqrtPa - 1 / sqrtPb);
  }

  /**
   * Calculate base token amount based on pre-token amount
   * @param y Amount of pre-token
   * @param pa Minimum price
   * @param pb Maximum price
   * @returns Amount of base token
   */
  calculateBaseAmount(y: number, pa: number, pb: number): number {
    if (pa >= pb || pa <= 0 || pb <= 0) {
      throw new Error(
        "Invalid price range: Pa must be less than Pb and both must be positive"
      );
    }

    const sqrtPa = Math.sqrt(pa);
    const sqrtPb = Math.sqrt(pb);

    return (y * (1 / sqrtPa - 1 / sqrtPb)) / (sqrtPb - sqrtPa);
  }

  /**
   * Calculate current price based on reserves
   * @param baseReserve Amount of base token in the pool
   * @param preTokenReserve Amount of pre-token in the pool
   * @param pa Minimum price
   * @param pb Maximum price
   * @returns Current price
   */
  calculateCurrentPrice(
    baseReserve: number,
    preTokenReserve: number,
    pa: number,
    pb: number
  ): number {
    if (preTokenReserve === 0) return pa;
    if (baseReserve === 0) return pb;

    const liquidity = this.calculateLiquidity(baseReserve, pa, pb);
    const sqrtPa = Math.sqrt(pa);
    const sqrtPb = Math.sqrt(pb);

    // Using the formula: y = L · (√P - √Pa)
    // Solving for P: P = (y/L + √Pa)²
    const sqrtP = preTokenReserve / liquidity + sqrtPa;
    return sqrtP * sqrtP;
  }

  /**
   * Calculate swap output amount
   * @param inputAmount Amount of input token
   * @param inputReserve Current reserve of input token
   * @param outputReserve Current reserve of output token
   * @param pa Minimum price
   * @param pb Maximum price
   * @returns Output amount
   */
  calculateSwapOutput(
    inputAmount: number,
    inputReserve: number,
    outputReserve: number,
    pa: number,
    pb: number,
    isBaseToPreToken: boolean
  ): number {
    if (inputAmount <= 0 || inputReserve <= 0 || outputReserve <= 0) {
      throw new Error("Invalid input: All amounts must be positive");
    }

    const liquidity = this.calculateLiquidity(inputReserve, pa, pb);

    if (isBaseToPreToken) {
      // Base token to pre-token swap
      const newBaseReserve = inputReserve + inputAmount;
      const newPreTokenReserve = this.calculatePreTokenAmount(
        newBaseReserve,
        pa,
        pb
      );
      return newPreTokenReserve - outputReserve;
    } else {
      // Pre-token to base token swap
      const newPreTokenReserve = outputReserve - inputAmount;
      if (newPreTokenReserve < 0) {
        throw new Error("Insufficient liquidity");
      }
      const newBaseReserve = this.calculateBaseAmount(
        newPreTokenReserve,
        pa,
        pb
      );
      return inputReserve - newBaseReserve;
    }
  }
}
