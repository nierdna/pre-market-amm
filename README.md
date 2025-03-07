# W-Pre-market AMM System

This repository contains PlantUML diagrams for the W-Pre-market AMM (Automated Market Maker) system, a specialized AMM designed for pre-market tokens.

## Overview

The W-Pre-market AMM is a system that enables trading of pre-market tokens before they are officially launched. It uses a specialized bonding curve formula to determine the price of tokens within a predefined price range (Pa to Pb) and includes mechanisms for collateral management, settlement, and handling token forfeitures.

### Key Features

- **Price Range Bounded Trading**: Trading occurs within a predefined price range (Pa to Pb)
- **Specialized Bonding Curve**: Uses mathematical formulas to determine token prices
- **Liquidity Provision**: LP providers can add liquidity with base token and receive LP tokens
- **Token Minting**: The system mints pre-token when liquidity is added
- **Trading**: Traders can buy and sell pre-token using base token
- **Collateral Requirement**: LP providers must provide additional base token as collateral
- **Settlement Phase**: After TGE, LP providers can withdraw liquidity by providing real tokens
- **Token Swapping**: Traders can swap pre-token for real token at a 1:1 ratio after TGE
- **Collateral Deadline Mechanism**: Enforces token deposit requirements with escalating penalties
- **Forfeiture Handling**: Manages forfeited collateral when LP providers fail to deposit tokens
- **Risk Management**: Assesses and mitigates risks through insurance funds and dynamic strategies

## Mathematical Formulas

The system uses the following key formulas:

### Liquidity (L)
```
L = x / (1/√Pa - 1/√Pb)
```
Where:
- x: Amount of base token
- Pa: Minimum price of pre-token
- Pb: Maximum price of pre-token

### Token Amounts at Price P
```
x = L · (1/√P - 1/√Pb)
y = L · (√P - √Pa)
```
Where:
- x: Amount of base token
- y: Amount of pre-token
- P: Current price
- L: Liquidity constant

### General Formula for pre-token Amount
```
y = x · (√Pb - √Pa) / (1/√Pa - 1/√Pb)
```
This formula is used when LP providers add liquidity to calculate how many pre-token should be minted.

## Diagrams

This repository contains the following PlantUML diagrams:

1. **Main Sequence Diagram** (`pre_market_amm.wsd`): Shows the core interactions between users and the system components
2. **Component Diagram** (`pre_market_amm_component.wsd`): Illustrates the system architecture and component relationships
3. **Class Diagram** (`pre_market_amm_class.wsd`): Displays the data structures and their relationships
4. **Settlement Phase Diagram** (`settle_ended_phase.wsd`): Details the processes during the settlement phase after TGE
5. **LP Collateral Deadline Diagram** (`lp_collateral_deadline.wsd`): Shows the deadline mechanism for token deposits
6. **LP Collateral Forfeiture Diagram** (`lp_collateral_forfeiture.wsd`): Illustrates how forfeited collateral is handled
7. **LP Collateral Economic Model Diagram** (`lp_collateral_economic_model.wsd`): Explains the economic model for collateral management

## How to Use

1. Install PlantUML: https://plantuml.com/starting
2. Open the `.wsd` files with a PlantUML compatible viewer
3. Generate diagrams using the PlantUML command line or plugins

## System Components

- **AMM Core**: Central component that coordinates all operations
- **Price Calculator**: Implements the bonding curve formulas
- **Token Minter**: Creates new pre-token when liquidity is added
- **Liquidity Manager**: Manages the liquidity pool
- **Swap Engine**: Handles token swaps
- **Liquidity Pool**: Stores base token and pre-token
- **Settlement Manager**: Handles the settlement phase after TGE
- **LP Position Trackers**: Tracks LP positions, collateral, and initial pre-token amounts
- **Risk Management Module**: Assesses risks and recommends optimal strategies
- **Oracle**: Provides market data for informed decision-making
- **Treasury**: Manages protocol funds and insurance mechanisms
- **Governance**: Protocol governance that can make strategic decisions

## User Types

1. **LP Provider**: Provides liquidity with base token and defines price range (Pa to Pb)
2. **Trader**: Trades base token for pre-token or vice versa
3. **Governance**: Makes strategic decisions for the protocol, especially in settlement phase

## Workflow

### LP Provider Workflow
1. LP provider adds base token (e.g., ETH, USDC) with parameters Pa and Pb
2. System calculates the amount of pre-token to mint using the formula
3. System mints pre-token and adds both tokens to the liquidity pool
4. LP provider adds an equal amount of base token as collateral
5. System records the initial pre-token amount minted for the LP position
6. LP provider receives LP tokens representing their share of the pool

### Trader Workflow
1. Trader sends base token to buy pre-token (or vice versa)
2. System calculates the output amount based on the bonding curve formula
3. System exchanges the tokens and sends the output to the trader
4. Price adjusts according to the bonding curve formula

### Early Withdrawal Workflow
1. LP provider requests to withdraw liquidity before settlement phase
2. System compares current pre-token balance with initial pre-token amount
3. If current < initial: System applies a penalty to the collateral
4. If current > initial: LP provider receives full collateral plus excess pre-token
5. System burns LP tokens and completes the withdrawal

### Settlement Phase Workflow (After TGE)
1. System enters settlement phase after token generation event (TGE)
2. Real tokens are added to the system
3. Deadline parameters are set for token deposits

#### LP Provider Settlement Workflow
1. LP provider requests to withdraw liquidity
2. System calculates required token amount = initial pre-token amount - current pre-token balance
3. LP provider provides the required token amount
4. System returns the LP provider's base token and collateral

#### Trader Settlement Workflow
1. Trader with pre-token can swap them for real tokens at a 1:1 ratio
2. System burns the pre-token and transfers real tokens to the trader

### Collateral Deadline Mechanism
1. Governance sets token deposit deadline parameters (base deadline, grace period, penalty schedule)
2. System notifies LP providers of deposit requirements
3. If deadline is missed, system enters grace period with escalating penalties
4. LP providers can still deposit tokens during grace period but incur penalties
5. If grace period expires, collateral is fully forfeited

### Forfeiture Handling
1. System identifies LP positions with missing token deposits after deadline
2. Forfeited collateral is managed through one of three approaches:
   - Proportional distribution to pre-token holders
   - Market purchase of tokens using forfeited collateral
   - Hybrid approach with governance decision (recommended)
3. In the hybrid approach, a portion is used to purchase tokens and the remainder for direct distribution
4. Traders can redeem pre-tokens for a combination of real tokens and base token compensation

## Risk Management and Economic Model

### Pre-TGE Risk Assessment
1. System assesses risk factors including collateral-to-pre-token ratio and LP provider reliability
2. Insurance fund is allocated based on risk assessment
3. Governance can adjust parameters based on risk profile

### Dynamic Strategy Selection
1. When collateral is forfeited, system analyzes market conditions
2. Optimal strategy is determined based on token price, liquidity, and market impact
3. Strategy execution balances token purchases and direct distribution

### Economic Outcomes
1. LP Providers who don't comply lose their collateral
2. Traders receive a combination of real tokens and base token compensation
3. Protocol takes a small fee from forfeited collateral for sustainability

## Implementation Notes

- The system ensures that the price always stays within the Pa to Pb range
- The bonding curve formula creates a predictable price curve
- LP providers must provide collateral when adding liquidity
- LP providers can only withdraw liquidity in settlement phase by providing real tokens
- The amount of real tokens required is equal to the difference between initial pre-token amount and current pre-token balance
- Traders can swap pre-token for real token at a 1:1 ratio in settlement phase
- The system can support multiple token pairs with different price ranges
- Collateral forfeiture is handled through a hybrid approach that balances token purchases and direct distribution
- Governance plays a key role in strategic decisions, especially during settlement phase
- The system includes notification mechanisms to remind LP providers of their obligations
- Risk management is integrated throughout the system to protect all stakeholders 