import { Token } from "./models/Token";
import { WPreMarketAMM } from "./models/WPreMarketAMM";
import * as readline from "readline";

// Create tokens
const baseToken = new Token("USD Coin", "USDC", 6);
const preToken = new Token("Pre-Token X", "pX", 18);
const realToken = new Token("Token X", "X", 18);

// Create AMM
const amm = new WPreMarketAMM();
let poolId: string;

// Create users
const users = {
  LP1: { address: "LP1", name: "LP Provider 1" },
  LP2: { address: "LP2", name: "LP Provider 2" },
  Trader1: { address: "Trader1", name: "Trader 1" },
  Trader2: { address: "Trader2", name: "Trader 2" },
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Initialize the system
function initialize() {
  console.clear();
  console.log("=".repeat(80));
  console.log("W-Pre-market AMM CLI Simulator");
  console.log("=".repeat(80));

  // Mint some base tokens to users
  baseToken.mint("LP1", 10000);
  baseToken.mint("LP2", 20000);
  baseToken.mint("Trader1", 5000);
  baseToken.mint("Trader2", 8000);

  // Create pool with initial price of 2.0
  poolId = amm.createPool(baseToken, preToken, 1.0, 5.0, 1); // Price range: $1.0 - $5.0, Initial price: $2.0

  showMainMenu();
}

// Show main menu
function showMainMenu() {
  console.log("\n" + "-".repeat(80));
  console.log("Main Menu:");
  console.log("-".repeat(80));
  console.log("1. Show Token Balances");
  console.log("2. Show Pool State");
  console.log("3. LP Provider Actions");
  console.log("4. Trader Actions");
  console.log("5. Enter Settlement Phase");
  console.log("6. Exit");
  console.log("-".repeat(80));

  rl.question("Select an option (1-6): ", (answer) => {
    switch (answer) {
      case "1":
        showTokenBalances();
        break;
      case "2":
        showPoolState();
        break;
      case "3":
        showLPProviderMenu();
        break;
      case "4":
        showTraderMenu();
        break;
      case "5":
        enterSettlementPhase();
        break;
      case "6":
        console.log("Exiting...");
        rl.close();
        break;
      default:
        console.log("Invalid option. Please try again.");
        showMainMenu();
        break;
    }
  });
}

// Show token balances
function showTokenBalances() {
  console.log("\n" + "-".repeat(80));
  console.log("Token Balances:");
  console.log("-".repeat(80));

  for (const user of Object.values(users)) {
    console.log(`${user.name}:`);
    console.log(`  ${baseToken.symbol}: ${baseToken.balanceOf(user.address)}`);
    console.log(
      `  ${preToken.symbol}: ${preToken.balanceOf(user.address).toFixed(6)}`
    );
    if (realToken.balanceOf(user.address) > 0) {
      console.log(
        `  ${realToken.symbol}: ${realToken.balanceOf(user.address)}`
      );
    }
    console.log("");
  }

  rl.question("Press Enter to continue...", () => {
    showMainMenu();
  });
}

// Show pool state
function showPoolState() {
  const pool = amm.getPool(poolId);

  console.log("\n" + "-".repeat(80));
  console.log("Pool State:");
  console.log("-".repeat(80));
  console.log(`Pool ID: ${poolId}`);
  console.log(`Current Price: $${pool.getCurrentPrice().toFixed(6)}`);
  console.log(`Settlement Phase: ${pool.isSettlementPhase ? "Yes" : "No"}`);

  if (pool.isSettlementPhase && pool.realToken) {
    console.log(`Real Token: ${pool.realToken.symbol}`);
  }

  console.log("\nLP Positions:");
  const positions = pool.getAllLPPositions();

  if (positions.length === 0) {
    console.log("No LP positions yet.");
  } else {
    positions.forEach((pos) => {
      console.log(`- Position ${pos.id}:`);
      console.log(`  Owner: ${users[pos.owner as keyof typeof users].name}`);
      console.log(`  Liquidity: ${pos.liquidity.toFixed(6)}`);
      console.log(
        `  Price Range: $${pos.lowerPriceBound} - $${pos.upperPriceBound}`
      );
      console.log(`  Collateral: ${pos.collateralAmount} ${baseToken.symbol}`);
      console.log(
        `  Initial Pre-Token: ${pos.initialPreTokenAmount.toFixed(6)} ${
          preToken.symbol
        }`
      );
      console.log(
        `  Base Token Reserve: ${pos.baseTokenReserve.toFixed(6)} ${
          baseToken.symbol
        }`
      );
      console.log(
        `  Pre-Token Reserve: ${pos.preTokenReserve.toFixed(6)} ${
          preToken.symbol
        }`
      );
    });
  }

  rl.question("Press Enter to continue...", () => {
    showMainMenu();
  });
}

// Show LP Provider menu
function showLPProviderMenu() {
  console.log("\n" + "-".repeat(80));
  console.log("LP Provider Actions:");
  console.log("-".repeat(80));
  console.log("1. Add Liquidity as LP1");
  console.log("2. Add Liquidity as LP2");
  console.log("3. Back to Main Menu");
  console.log("-".repeat(80));

  rl.question("Select an option (1-3): ", (answer) => {
    switch (answer) {
      case "1":
        addLiquidity("LP1");
        break;
      case "2":
        addLiquidity("LP2");
        break;
      case "3":
        showMainMenu();
        break;
      default:
        console.log("Invalid option. Please try again.");
        showLPProviderMenu();
        break;
    }
  });
}

// Add liquidity
function addLiquidity(lpAddress: string) {
  const user = users[lpAddress as keyof typeof users];
  const currentBalance = baseToken.balanceOf(lpAddress);

  console.log("\n" + "-".repeat(80));
  console.log(`Add Liquidity as ${user.name}:`);
  console.log("-".repeat(80));
  console.log(`Current ${baseToken.symbol} Balance: ${currentBalance}`);

  rl.question(
    `Enter amount of ${baseToken.symbol} to add (max ${currentBalance}): `,
    (amountStr) => {
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0 || amount > currentBalance) {
        console.log("Invalid amount. Please try again.");
        addLiquidity(lpAddress);
        return;
      }

      rl.question("Enter minimum price (Pa): ", (paStr) => {
        const pa = parseFloat(paStr);

        if (isNaN(pa) || pa <= 0) {
          console.log("Invalid price. Please try again.");
          addLiquidity(lpAddress);
          return;
        }

        rl.question("Enter maximum price (Pb): ", (pbStr) => {
          const pb = parseFloat(pbStr);

          if (isNaN(pb) || pb <= pa) {
            console.log(
              "Invalid price. Maximum price must be greater than minimum price."
            );
            addLiquidity(lpAddress);
            return;
          }

          try {
            const positionId = amm.addLiquidity(
              poolId,
              lpAddress,
              amount,
              pa,
              pb
            );
            console.log(
              `\nSuccessfully added liquidity. Position ID: ${positionId}`
            );
          } catch (error) {
            console.error(
              `Error: ${error instanceof Error ? error.message : String(error)}`
            );
          }

          rl.question("Press Enter to continue...", () => {
            showLPProviderMenu();
          });
        });
      });
    }
  );
}

// Show Trader menu
function showTraderMenu() {
  console.log("\n" + "-".repeat(80));
  console.log("Trader Actions:");
  console.log("-".repeat(80));
  console.log("1. Buy Pre-Tokens as Trader1");
  console.log("2. Buy Pre-Tokens as Trader2");
  console.log("3. Sell Pre-Tokens as Trader1");
  console.log("4. Sell Pre-Tokens as Trader2");
  console.log("5. Back to Main Menu");
  console.log("-".repeat(80));

  rl.question("Select an option (1-5): ", (answer) => {
    switch (answer) {
      case "1":
        buyPreTokens("Trader1");
        break;
      case "2":
        buyPreTokens("Trader2");
        break;
      case "3":
        sellPreTokens("Trader1");
        break;
      case "4":
        sellPreTokens("Trader2");
        break;
      case "5":
        showMainMenu();
        break;
      default:
        console.log("Invalid option. Please try again.");
        showTraderMenu();
        break;
    }
  });
}

// Buy pre-tokens
function buyPreTokens(traderAddress: string) {
  const user = users[traderAddress as keyof typeof users];
  const currentBalance = baseToken.balanceOf(traderAddress);

  console.log("\n" + "-".repeat(80));
  console.log(`Buy Pre-Tokens as ${user.name}:`);
  console.log("-".repeat(80));
  console.log(`Current ${baseToken.symbol} Balance: ${currentBalance}`);

  rl.question(
    `Enter amount of ${baseToken.symbol} to spend (max ${currentBalance}): `,
    (amountStr) => {
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0 || amount > currentBalance) {
        console.log("Invalid amount. Please try again.");
        buyPreTokens(traderAddress);
        return;
      }

      try {
        const preTokensReceived = amm.swapBaseForPreToken(
          poolId,
          traderAddress,
          amount
        );
        console.log(
          `\nSuccessfully bought ${preTokensReceived.toFixed(6)} ${
            preToken.symbol
          }`
        );
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      rl.question("Press Enter to continue...", () => {
        showTraderMenu();
      });
    }
  );
}

// Sell pre-tokens
function sellPreTokens(traderAddress: string) {
  const user = users[traderAddress as keyof typeof users];
  const currentBalance = preToken.balanceOf(traderAddress);

  console.log("\n" + "-".repeat(80));
  console.log(`Sell Pre-Tokens as ${user.name}:`);
  console.log("-".repeat(80));
  console.log(
    `Current ${preToken.symbol} Balance: ${currentBalance.toFixed(6)}`
  );

  if (currentBalance <= 0) {
    console.log(`You don't have any ${preToken.symbol} to sell.`);
    rl.question("Press Enter to continue...", () => {
      showTraderMenu();
    });
    return;
  }

  rl.question(
    `Enter amount of ${preToken.symbol} to sell (max ${currentBalance.toFixed(
      6
    )}): `,
    (amountStr) => {
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0 || amount > currentBalance) {
        console.log("Invalid amount. Please try again.");
        sellPreTokens(traderAddress);
        return;
      }

      try {
        const baseTokensReceived = amm.swapPreTokenForBase(
          poolId,
          traderAddress,
          amount
        );
        console.log(
          `\nSuccessfully sold ${amount.toFixed(6)} ${
            preToken.symbol
          } for ${baseTokensReceived.toFixed(6)} ${baseToken.symbol}`
        );
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      rl.question("Press Enter to continue...", () => {
        showTraderMenu();
      });
    }
  );
}

// Enter settlement phase
function enterSettlementPhase() {
  const pool = amm.getPool(poolId);

  if (pool.isSettlementPhase) {
    console.log("Pool is already in settlement phase.");
    rl.question("Press Enter to continue...", () => {
      showMainMenu();
    });
    return;
  }

  console.log("\n" + "-".repeat(80));
  console.log("Enter Settlement Phase (After TGE):");
  console.log("-".repeat(80));
  console.log(
    "This will mark the end of the pre-market phase and start the settlement phase."
  );
  console.log(
    "In a real implementation, this would happen after the Token Generation Event (TGE)."
  );

  rl.question(
    "Are you sure you want to enter settlement phase? (y/n): ",
    (answer) => {
      if (answer.toLowerCase() === "y") {
        try {
          amm.enterSettlementPhase(poolId, realToken);
          console.log("\nSuccessfully entered settlement phase.");
        } catch (error) {
          console.error(
            `Error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      rl.question("Press Enter to continue...", () => {
        showMainMenu();
      });
    }
  );
}

// Start the CLI
initialize();
