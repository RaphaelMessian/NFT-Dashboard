# NFT Launch Dashboard — Hedera Hashgraph Testnet

A full-stack dashboard for monitoring an NFT launch on Hedera Hashgraph testnet. Includes an ERC-721 smart contract, deployment/interaction scripts, and a React dashboard that reads data from the Hedera Mirror Node.

## What It Tracks

| Metric | Source |
|---|---|
| **Total Minted** | ERC-721 `Transfer` events from `0x0` |
| **Total Transfers** | ERC-721 `Transfer` events between non-zero addresses |
| **Unique Holders** | Computed from replaying all Transfer events |
| **Wallets Created** | `CRYPTOCREATEACCOUNT` transactions from your account |

## Architecture

```
┌──────────────┐      deploy / mint / transfer      ┌──────────────────┐
│  Hardhat      │ ─────────────────────────────────► │  Hedera Testnet  │
│  Scripts      │   (JSON-RPC via hashio.io)         │  (EVM + HTS)     │
└──────────────┘                                     └──────┬───────────┘
                                                            │ indexed by
┌──────────────┐      REST API queries               ┌─────▼───────────┐
│  React        │ ◄──────────────────────────────────│  Mirror Node     │
│  Dashboard    │   (testnet.mirrornode.hedera.com)  │  (Testnet)       │
└──────────────┘                                     └──────────────────┘
```

## Prerequisites

- **Node.js** v18+ and npm
- A **Hedera Testnet account** — create one at [portal.hedera.com](https://portal.hedera.com/)
  - You need the **Account ID** (e.g., `0.0.12345`) and **ECDSA Private Key** (hex, starting with `0x`)

## Quick Start

### 1. Install Dependencies

```bash
# Root (Hardhat + contracts)
npm install

# Dashboard (React)
cd dashboard && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Hedera testnet credentials:

```env
HEDERA_ACCOUNT_ID=0.0.XXXXX
HEDERA_PRIVATE_KEY=0x...your_ecdsa_private_key
```

### 3. Compile the Contract

```bash
npm run compile
```

### 4. Deploy & Generate Activity

**Option A: Run the full demo** (deploy + create wallets + mint + transfer):

```bash
npm run demo
```

**Option B: Step by step:**

```bash
# Deploy the contract
npm run deploy
# Copy the contract address to .env as NFT_CONTRACT_ADDRESS

# Create wallets (sends 1 HBAR each to auto-create accounts)
npm run create-wallets

# Mint NFTs (defaults to 1 NFT to the owner)
npm run mint
# Or mint multiple: MINT_COUNT=5 npm run mint
# Or mint to a specific address: MINT_TO=0x... npm run mint

# Transfer an NFT
# Set TRANSFER_TO and TRANSFER_TOKEN_ID first
TRANSFER_TO=0x... TRANSFER_TOKEN_ID=1 npm run transfer
```

### 5. Launch the Dashboard

```bash
npm run dashboard
# or: cd dashboard && npm run dev
```

Open **http://localhost:3000** in your browser.

Enter your **contract's EVM address** (or Hedera contract ID like `0.0.XXXXX`) and optionally your **account ID** for wallet creation tracking. Click **Fetch Data**.

The dashboard auto-refreshes every 30 seconds.

## Project Structure

```
NFT-dashboard/
├── contracts/
│   └── LaunchNFT.sol          # ERC-721 with mint, mintBatch, Enumerable
├── scripts/
│   ├── deploy.js              # Deploy to Hedera testnet
│   ├── mint.js                # Mint NFTs
│   ├── transfer.js            # Transfer an NFT
│   ├── createWallets.js       # Create new wallets (auto-account creation)
│   └── demo.js                # Full demo: deploy + wallets + mint + transfer
├── dashboard/
│   ├── src/
│   │   ├── App.jsx            # Main dashboard layout
│   │   ├── api/
│   │   │   └── mirrorNode.js  # Hedera Mirror Node API client
│   │   ├── hooks/
│   │   │   └── useDashboardData.js  # Data fetching hook
│   │   └── components/
│   │       ├── ConfigPanel.jsx       # Contract/account input
│   │       ├── StatsCards.jsx        # KPI cards
│   │       ├── ActivityChart.jsx     # Daily mint/transfer area chart
│   │       ├── MintChart.jsx         # Cumulative mints line chart
│   │       ├── HolderDistribution.jsx # Bar chart of holder ranges
│   │       ├── HoldersTable.jsx      # Top holders table
│   │       └── ActivityTable.jsx     # Recent events table
│   └── package.json
├── hardhat.config.js
├── package.json
├── .env.example
└── README.md
```

## Dashboard Features

- **Stats Cards** — Total mints, transfers, unique holders, wallets created
- **Daily Activity Chart** — Area chart of mints and transfers over time
- **Cumulative Mints** — Step chart showing total NFTs minted
- **Holder Distribution** — Bar chart grouping holders by NFT count
- **Top Holders Table** — Addresses ranked by number of NFTs held, with links to HashScan
- **Activity Table** — Chronological list of all mint and transfer events
- **Auto-refresh** — Polls mirror node every 30 seconds
- **Persistent config** — Contract/account IDs saved to localStorage

## Hedera Specifics

- **JSON-RPC Relay**: Contract interactions use `https://testnet.hashio.io/api` (Hedera's community relay)
- **Mirror Node**: Dashboard reads from `https://testnet.mirrornode.hedera.com`
- **Auto-account creation**: Sending HBAR to a new EVM address on Hedera automatically creates the account (lazy creation)
- **Gas costs**: Hedera uses HBAR for gas; testnet HBAR is free from the [portal](https://portal.hedera.com/)

## Switching to Mainnet

Update these values:
- `hardhat.config.js`: Change URL to `https://mainnet.hashio.io/api` and chainId to `295`
- `dashboard/src/api/mirrorNode.js`: Change `MIRROR_BASE` to `https://mainnet-public.mirrornode.hedera.com`
