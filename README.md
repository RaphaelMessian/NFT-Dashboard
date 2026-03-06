# NFT Launch Dashboard — Hedera Hashgraph Testnet

A full-stack dashboard for monitoring an NFT launch on Hedera Hashgraph testnet. Includes an ERC-721 smart contract, deployment/interaction scripts, a React dashboard, and a MongoDB-backed report page with D3 analytics.

## What It Tracks

| Metric | Source |
|---|---|
| **Total Minted** | ERC-721 `Transfer` events from `0x0` |
| **Total Transfers** | ERC-721 `Transfer` events between non-zero addresses |
| **Unique Holders** | Computed from replaying all Transfer events |
| **Wallets Created** | `CRYPTOCREATEACCOUNT` transactions from your account |

## Architecture

```
┌──────────────┐   deploy / mint / transfer   ┌──────────────────┐
│  Hardhat      │ ───────────────────────────► │  Hedera Testnet  │
│  Scripts      │   (JSON-RPC via hashio.io)   │  (EVM + HTS)     │
└──────────────┘                               └──────┬───────────┘
                                                      │ Mirror Node
            ┌─────────────────────────────────────────┘
            │
     ┌──────▼──────┐  snapshots  ┌──────────┐  REST API  ┌───────────┐
     │  sync        │ ──────────► │ MongoDB  │ ──────────► │  React    │
     │  (Node.js)   │             └──────────┘             │ Dashboard │
     └─────────────┘                  ▲                    └───────────┘
                              ┌───────┴──────┐
                              │  Express API  │
                              │  (port 3002)  │
                              └──────────────┘
```

## Prerequisites

- **Docker Desktop** — the only thing you need to run the full stack
- A **Hedera Testnet account** — create one at [portal.hedera.com](https://portal.hedera.com/)
  - You need the **Account ID** (e.g., `0.0.12345`) and **ECDSA Private Key** (hex, starting with `0x`)
- **Node.js** v18+ and npm — only needed for the Hardhat contract scripts

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
HEDERA_ACCOUNT_ID=0.0.XXXXX
HEDERA_PRIVATE_KEY=0x...your_ecdsa_private_key
NFT_CONTRACT_ADDRESS=0x...         # fill after deploying
VITE_NFT_CONTRACTS=Label:0x...     # contract(s) to monitor
VITE_ACCOUNT_ID=0.0.XXXXX          # account for wallet tracking
SYNC_INTERVAL_MINUTES=30           # how often the sync runs (0 = once)
```

### 2. Deploy & Generate Activity (optional — skip if contract already exists)

```bash
npm install

# Full demo: deploy + create wallets + mint + transfer
npm run demo

# Or step by step:
npm run deploy          # deploy contract, copy address to .env
npm run create-wallets  # create test wallets
npm run mint            # mint NFTs (MINT_COUNT=5 npm run mint)
npm run transfer        # transfer an NFT
```

### 3. Start Everything with Docker

```bash
docker compose up --build
```

That's it. All four services start automatically:

| Service | URL | Description |
|---|---|---|
| **Dashboard** | http://localhost:3000 | React + D3 analytics UI |
| **API** | http://localhost:3002 | Express REST API |
| **MongoDB** | internal | Persistent data volume |
| **Sync** | — | Continuously fetches on-chain data |

The sync runs once immediately on startup, then repeats every `SYNC_INTERVAL_MINUTES` minutes. The Report page always shows the latest snapshot.

### 4. Stop

```bash
docker compose down        # stop containers, keep data
docker compose down -v     # stop and delete all data
```

## Configuration (`.env`)

| Variable | Description |
|---|---|
| `HEDERA_ACCOUNT_ID` | Your Hedera testnet account ID |
| `HEDERA_PRIVATE_KEY` | ECDSA private key (hex, `0x...`) |
| `NFT_CONTRACT_ADDRESS` | Deployed contract EVM address |
| `VITE_NFT_CONTRACTS` | Contracts to monitor: `Label:0x...,Label2:0x...` |
| `VITE_ACCOUNT_ID` | Account ID for wallet creation tracking |
| `VITE_API_URL` | API base URL (default: `http://localhost:3002`) |
| `SYNC_INTERVAL_MINUTES` | Sync frequency in minutes (`0` = run once and stop) |

## Project Structure

```
NFT-dashboard/
├── contracts/
│   └── LaunchNFT.sol          # ERC-721 with mint, mintBatch, Enumerable
├── scripts/
│   ├── deploy.js              # Deploy to Hedera testnet
│   ├── mint.js                # Mint NFTs
│   ├── transfer.js            # Transfer an NFT
│   ├── createWallets.js       # Create new wallets
│   └── demo.js                # Full demo script
├── dashboard/
│   ├── Dockerfile             # Multi-stage: Vite build → nginx
│   ├── nginx.conf             # SPA routing config
│   └── src/
│       ├── App.jsx
│       ├── api/
│       │   ├── mirrorNode.js  # Hedera Mirror Node client
│       │   └── reportApi.js   # Express API client
│       ├── pages/
│       │   ├── OverviewPage.jsx
│       │   ├── ContractDetailPage.jsx
│       │   └── ReportPage.jsx # D3 analytics from MongoDB snapshots
│       └── components/
├── server/
│   ├── Dockerfile
│   └── src/
│       ├── server.js          # Express API (port 3002)
│       ├── sync.js            # Hedera → MongoDB sync (runs in loop)
│       └── db.js              # MongoDB connection
├── docker-compose.yml         # Orchestrates all 4 services
├── hardhat.config.js
├── package.json
├── .env
└── README.md
```

## Dashboard Features

- **Overview** — Live stats from Hedera Mirror Node (auto-refreshes every 30s)
- **Contract Detail** — Per-contract breakdown of mints, transfers, and holders
- **Report** — D3.js analytics from MongoDB snapshots:
  - Mint timing heatmap, holder growth, churn funnel, mint velocity
  - Gini coefficient, sell pressure, whale watchlist
  - Cross-race (multi-contract) retention analysis

## Hedera Specifics

- **JSON-RPC Relay**: Contract interactions use `https://testnet.hashio.io/api`
- **Mirror Node**: `https://testnet.mirrornode.hedera.com`
- **Auto-account creation**: Sending HBAR to a new EVM address automatically creates the account
- **Gas costs**: Hedera uses HBAR for gas; testnet HBAR is free from the [portal](https://portal.hedera.com/)

## Switching to Mainnet

Update these values:
- `hardhat.config.js`: URL → `https://mainnet.hashio.io/api`, chainId → `295`
- `server/src/sync.js`: `MIRROR_BASE` → `https://mainnet-public.mirrornode.hedera.com`
- `dashboard/src/api/mirrorNode.js`: same `MIRROR_BASE` change
