import { Token } from "./models/Token";
import { WPreMarketAMM } from "./models/WPreMarketAMM";

// Simulation of W-Pre-market AMM
function runSimulation() {
  console.log("=".repeat(80));
  console.log("W-Pre-market AMM Simulation");
  console.log("=".repeat(80));

  // Create tokens
  const baseToken = new Token("USD Coin", "USDC", 6);
  const preToken = new Token("Pre-Token X", "pX", 18);
  const realToken = new Token("Token X", "X", 18);

  // Mint some base tokens to users
  baseToken.mint("LP1", 10000);
  baseToken.mint("LP2", 20000);
  baseToken.mint("Trader1", 5000);
  baseToken.mint("Trader2", 8000);

  // Create AMM
  const amm = new WPreMarketAMM();

  // Create pool with initial price of 2.0
  const poolId = amm.createPool(baseToken, preToken, 1.0, 5.0, 2.0); // Price range: $1.0 - $5.0, Initial price: $2.0

  console.log("\n" + "-".repeat(80));
  console.log("Initial Token Balances:");
  console.log("-".repeat(80));
  console.log(`LP1: ${baseToken.balanceOf("LP1")} ${baseToken.symbol}`);
  console.log(`LP2: ${baseToken.balanceOf("LP2")} ${baseToken.symbol}`);
  console.log(`Trader1: ${baseToken.balanceOf("Trader1")} ${baseToken.symbol}`);
  console.log(`Trader2: ${baseToken.balanceOf("Trader2")} ${baseToken.symbol}`);

  // Display initial pool state
  const pool = amm.getPool(poolId);
  console.log("\n" + "-".repeat(80));
  console.log("Initial Pool State:");
  console.log("-".repeat(80));
  console.log(`Base Token Reserve: ${pool.baseReserve} ${baseToken.symbol}`);
  console.log(
    `Pre-Token Reserve: ${pool.preTokenReserve.toFixed(6)} ${preToken.symbol}`
  );
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`); // Should be 2.0 (initial price)

  // LP1 adds liquidity
  console.log("\n" + "-".repeat(80));
  console.log("LP1 Adds Liquidity:");
  console.log("-".repeat(80));
  const lp1PositionId = amm.addLiquidity(poolId, "LP1", 5000, 1.0, 5.0);

  // LP2 adds liquidity with different price range
  console.log("\n" + "-".repeat(80));
  console.log("LP2 Adds Liquidity:");
  console.log("-".repeat(80));
  const lp2PositionId = amm.addLiquidity(poolId, "LP2", 10000, 1.5, 4.0);

  // Display pool state after liquidity addition
  console.log("\n" + "-".repeat(80));
  console.log("Pool State After Liquidity Addition:");
  console.log("-".repeat(80));
  console.log(`Base Token Reserve: ${pool.baseReserve} ${baseToken.symbol}`);
  console.log(
    `Pre-Token Reserve: ${pool.preTokenReserve.toFixed(6)} ${preToken.symbol}`
  );
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`); // Should still be 2.0 (adding liquidity doesn't change price)

  // Trader1 buys pre-tokens
  console.log("\n" + "-".repeat(80));
  console.log("Trader1 Buys Pre-Tokens:");
  console.log("-".repeat(80));
  const preTokensReceived = amm.swapBaseForPreToken(poolId, "Trader1", 2000);

  // Display balances after trade
  console.log("\n" + "-".repeat(80));
  console.log("Balances After Trader1 Buys Pre-Tokens:");
  console.log("-".repeat(80));
  console.log(
    `Trader1 Base Token: ${baseToken.balanceOf("Trader1")} ${baseToken.symbol}`
  );
  console.log(
    `Trader1 Pre-Token: ${preToken.balanceOf("Trader1").toFixed(6)} ${
      preToken.symbol
    }`
  );
  console.log(`Pool Base Token: ${pool.baseReserve} ${baseToken.symbol}`);
  console.log(
    `Pool Pre-Token: ${pool.preTokenReserve.toFixed(6)} ${preToken.symbol}`
  );
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`); // Price should change after swap

  // Trader2 buys pre-tokens
  console.log("\n" + "-".repeat(80));
  console.log("Trader2 Buys Pre-Tokens:");
  console.log("-".repeat(80));
  const preTokensReceived2 = amm.swapBaseForPreToken(poolId, "Trader2", 3000);

  // Display balances after trade
  console.log("\n" + "-".repeat(80));
  console.log("Balances After Trader2 Buys Pre-Tokens:");
  console.log("-".repeat(80));
  console.log(
    `Trader2 Base Token: ${baseToken.balanceOf("Trader2")} ${baseToken.symbol}`
  );
  console.log(
    `Trader2 Pre-Token: ${preToken.balanceOf("Trader2").toFixed(6)} ${
      preToken.symbol
    }`
  );
  console.log(`Pool Base Token: ${pool.baseReserve} ${baseToken.symbol}`);
  console.log(
    `Pool Pre-Token: ${pool.preTokenReserve.toFixed(6)} ${preToken.symbol}`
  );
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`); // Price should change after swap

  // Trader1 sells some pre-tokens
  console.log("\n" + "-".repeat(80));
  console.log("Trader1 Sells Pre-Tokens:");
  console.log("-".repeat(80));
  const sellAmount = preToken.balanceOf("Trader1") / 2; // Sell half of the pre-tokens
  const baseTokensReceived = amm.swapPreTokenForBase(
    poolId,
    "Trader1",
    sellAmount
  );

  // Display balances after trade
  console.log("\n" + "-".repeat(80));
  console.log("Balances After Trader1 Sells Pre-Tokens:");
  console.log("-".repeat(80));
  console.log(
    `Trader1 Base Token: ${baseToken.balanceOf("Trader1")} ${baseToken.symbol}`
  );
  console.log(
    `Trader1 Pre-Token: ${preToken.balanceOf("Trader1").toFixed(6)} ${
      preToken.symbol
    }`
  );
  console.log(`Pool Base Token: ${pool.baseReserve} ${baseToken.symbol}`);
  console.log(
    `Pool Pre-Token: ${pool.preTokenReserve.toFixed(6)} ${preToken.symbol}`
  );
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`); // Price should change after swap

  // Enter settlement phase (after TGE)
  console.log("\n" + "-".repeat(80));
  console.log("Entering Settlement Phase (After TGE):");
  console.log("-".repeat(80));
  amm.enterSettlementPhase(poolId, realToken);

  console.log("\n" + "-".repeat(80));
  console.log("Final Pool State:");
  console.log("-".repeat(80));
  console.log(`Base Token Reserve: ${pool.baseReserve} ${baseToken.symbol}`);
  console.log(
    `Pre-Token Reserve: ${pool.preTokenReserve.toFixed(6)} ${preToken.symbol}`
  );
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`);
  console.log(`Settlement Phase: ${pool.isSettlementPhase ? "Yes" : "No"}`);

  console.log("\n" + "-".repeat(80));
  console.log("Final Token Balances:");
  console.log("-".repeat(80));
  console.log(`LP1: ${baseToken.balanceOf("LP1")} ${baseToken.symbol}`);
  console.log(`LP2: ${baseToken.balanceOf("LP2")} ${baseToken.symbol}`);
  console.log(
    `Trader1: ${baseToken.balanceOf("Trader1")} ${baseToken.symbol}, ${preToken
      .balanceOf("Trader1")
      .toFixed(6)} ${preToken.symbol}`
  );
  console.log(
    `Trader2: ${baseToken.balanceOf("Trader2")} ${baseToken.symbol}, ${preToken
      .balanceOf("Trader2")
      .toFixed(6)} ${preToken.symbol}`
  );

  console.log("\n" + "=".repeat(80));
  console.log("Simulation Complete");
  console.log("=".repeat(80));
}

// Run the simulation
runSimulation();