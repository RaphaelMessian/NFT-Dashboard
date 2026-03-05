const hre = require("hardhat");
const {
  Client,
  AccountCreateTransaction,
  PrivateKey,
  Hbar,
  AccountId,
} = require("@hashgraph/sdk");

/**
 * Data-seeding script — 1 NFT per user model.
 *
 * Deploys TWO NFT contracts and generates activity so every
 * relevant dashboard metric has visible data:
 *
 *   - Mint velocity              (mints over time)
 *   - Mint timing heatmap        (mints at varied intervals)
 *   - Holder growth over time    (staggered mints)
 *   - Churn funnel               (some wallets only mint on contract 1)
 *   - Multi-race holders         (some wallets mint on both contracts)
 *   - Return rate                (contract 1 → contract 2 retention)
 *   - Single-use wallet rate     (some wallets never transfer)
 *   - Time-to-mint               (varied delay from account creation)
 *   - Sell pressure              (some users transfer/sell their NFT)
 *
 * Each user gets at most 1 NFT per contract.
 *
 * Usage:
 *   npx hardhat run scripts/seed.js --network hedera_testnet
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Hedera testnet needs generous pauses between TXs
const TX_DELAY = 4000;

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║    NFT Dashboard — Seed (1 NFT per user)     ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log("Owner:", owner.address);

  // ── Hedera SDK client ──
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);
  const hederaClient = Client.forTestnet().setOperator(operatorId, operatorKey);

  // ══════════════════════════════════════════
  // 1. Deploy TWO NFT contracts
  // ══════════════════════════════════════════
  console.log("\n━━━ Step 1: Deploy two NFT contracts ━━━");
  const LaunchNFT = await hre.ethers.getContractFactory("LaunchNFT");

  const nft1 = await LaunchNFT.deploy("Alpha Race", "ALPHA", "https://example.com/alpha/");
  await nft1.waitForDeployment();
  const addr1 = await nft1.getAddress();
  console.log("Contract 1 (Alpha Race):", addr1);

  await sleep(TX_DELAY);

  const nft2 = await LaunchNFT.deploy("Beta Race", "BETA", "https://example.com/beta/");
  await nft2.waitForDeployment();
  const addr2 = await nft2.getAddress();
  console.log("Contract 2 (Beta Race):", addr2);

  // ══════════════════════════════════════════
  // 2. Create 12 wallets with varied timing
  // ══════════════════════════════════════════
  console.log("\n━━━ Step 2: Create 12 wallets ━━━");
  const wallets = [];
  const walletInfos = [];

  for (let i = 0; i < 12; i++) {
    const newKey = PrivateKey.generateECDSA();
    const evmAddress = `0x${newKey.publicKey.toEvmAddress()}`;

    const txResponse = await new AccountCreateTransaction()
      .setKey(newKey.publicKey)
      .setInitialBalance(new Hbar(15))
      .setAlias(newKey.publicKey.toEvmAddress())
      .execute(hederaClient);

    const receipt = await txResponse.getReceipt(hederaClient);
    const newAccountId = receipt.accountId;

    const w = new hre.ethers.Wallet(newKey.toStringRaw(), hre.ethers.provider);
    wallets.push(w);
    walletInfos.push({ index: i + 1, accountId: newAccountId.toString(), evmAddress });
    console.log(`  Wallet ${i + 1}: ${evmAddress} (${newAccountId})`);

    await sleep(TX_DELAY);
  }

  // ══════════════════════════════════════════
  // 3. Mint 1 NFT per user on Alpha Race
  //
  //    Owner + Wallets 1–8 get 1 NFT each = 9 mints
  //    Wallets 9–12 skip Alpha → churn funnel data
  // ══════════════════════════════════════════
  console.log("\n━━━ Step 3: Mint on Alpha Race (1 per user) ━━━");

  // Owner gets 1 NFT
  let tx = await nft1.mint(owner.address);
  await tx.wait();
  console.log("  Owner:    1 NFT minted (token #1)");
  await sleep(TX_DELAY);

  // Wallets 1–8 each get 1 NFT
  for (let i = 0; i < 8; i++) {
    tx = await nft1.mint(wallets[i].address);
    await tx.wait();
    console.log(`  Wallet ${i + 1}: 1 NFT minted (token #${i + 2})`);
    await sleep(TX_DELAY);
  }

  console.log("  Wallets 9-12: skipped Alpha (churn funnel data)");
  const alpha_total = 9;
  console.log(`  Total Alpha supply: ${alpha_total} (9 unique holders)`);

  // ══════════════════════════════════════════
  // 4. Transfers on Alpha Race
  //
  //    - Owner sells their NFT → sell pressure
  //    - Wallet 1 sells theirs
  //    - Wallet 2 sells theirs
  //    These transfers mean some users no longer hold Alpha
  // ══════════════════════════════════════════
  console.log("\n━━━ Step 4: Transfers on Alpha Race ━━━");

  // Owner → Wallet 9 (owner sells their only NFT)
  tx = await nft1.transferFrom(owner.address, wallets[8].address, 1);
  await tx.wait();
  console.log("  Owner → Wallet 9 (token #1) — owner sold");
  await sleep(TX_DELAY);

  // Wallet 1 → Wallet 10 (wallet 1 sells)
  let nftW1 = nft1.connect(wallets[0]);
  tx = await nftW1.transferFrom(wallets[0].address, wallets[9].address, 2);
  await tx.wait();
  console.log("  Wallet 1 → Wallet 10 (token #2) — wallet 1 sold");
  await sleep(TX_DELAY);

  // Wallet 2 → Wallet 11 (wallet 2 sells)
  let nftW2 = nft1.connect(wallets[1]);
  tx = await nftW2.transferFrom(wallets[1].address, wallets[10].address, 3);
  await tx.wait();
  console.log("  Wallet 2 → Wallet 11 (token #3) — wallet 2 sold");
  await sleep(TX_DELAY);

  console.log("  3 transfers completed on Alpha");
  console.log("  New holder picture: Wallets 3-8 (original), Wallets 9-11 (bought)");

  // ══════════════════════════════════════════
  // 5. Mint 1 NFT per user on Beta Race
  //
  //    Some Alpha wallets return → return rate / multi-race
  //    Some new wallets appear → churn funnel
  // ══════════════════════════════════════════
  console.log("\n━━━ Step 5: Mint on Beta Race (1 per user) ━━━");

  // Owner: 1 NFT (returning)
  tx = await nft2.mint(owner.address);
  await tx.wait();
  console.log("  Owner:     1 NFT (returning from Alpha)");
  await sleep(TX_DELAY);

  // Wallet 1: returns to mint Beta even though they sold Alpha
  tx = await nft2.mint(wallets[0].address);
  await tx.wait();
  console.log("  Wallet 1:  1 NFT (returning)");
  await sleep(TX_DELAY);

  // Wallet 3: returns
  tx = await nft2.mint(wallets[2].address);
  await tx.wait();
  console.log("  Wallet 3:  1 NFT (returning)");
  await sleep(TX_DELAY);

  // Wallet 5: returns
  tx = await nft2.mint(wallets[4].address);
  await tx.wait();
  console.log("  Wallet 5:  1 NFT (returning)");
  await sleep(TX_DELAY);

  // Wallet 6: returns
  tx = await nft2.mint(wallets[5].address);
  await tx.wait();
  console.log("  Wallet 6:  1 NFT (returning)");
  await sleep(TX_DELAY);

  // Wallets 2, 4, 7, 8 skip Beta → churned from Alpha

  // Wallet 9: Beta newcomer (got Alpha via transfer, now mints Beta)
  tx = await nft2.mint(wallets[8].address);
  await tx.wait();
  console.log("  Wallet 9:  1 NFT (Beta newcomer)");
  await sleep(TX_DELAY);

  // Wallet 10: Beta newcomer
  tx = await nft2.mint(wallets[9].address);
  await tx.wait();
  console.log("  Wallet 10: 1 NFT (Beta newcomer)");
  await sleep(TX_DELAY);

  // Wallet 11: Beta newcomer
  tx = await nft2.mint(wallets[10].address);
  await tx.wait();
  console.log("  Wallet 11: 1 NFT (Beta newcomer)");
  await sleep(TX_DELAY);

  // Wallet 12: Beta-only (never touched Alpha)
  tx = await nft2.mint(wallets[11].address);
  await tx.wait();
  console.log("  Wallet 12: 1 NFT (Beta only, single-use)");
  await sleep(TX_DELAY);

  const beta_total = 9;
  console.log(`  Total Beta supply: ${beta_total} (9 unique holders)`);

  // ══════════════════════════════════════════
  // 6. Transfers on Beta Race
  // ══════════════════════════════════════════
  console.log("\n━━━ Step 6: Transfers on Beta Race ━━━");

  // Owner sells Beta NFT → Wallet 12
  tx = await nft2.transferFrom(owner.address, wallets[11].address, 1);
  await tx.wait();
  console.log("  Owner → Wallet 12 (token #1) — owner sold Beta too");
  await sleep(TX_DELAY);

  // Wallet 10 sells → Wallet 3
  let nft2W10 = nft2.connect(wallets[9]);
  tx = await nft2W10.transferFrom(wallets[9].address, wallets[2].address, 7);
  await tx.wait();
  console.log("  Wallet 10 → Wallet 3 (token #7) — sold");
  await sleep(TX_DELAY);

  console.log("  2 transfers completed on Beta");

  // ══════════════════════════════════════════
  // 7. Summary
  // ══════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║               Seed Summary                   ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`\n  Alpha Race:  ${addr1}`);
  console.log(`    Supply: ${alpha_total}  |  Holders: 9  |  Transfers: 3`);
  console.log(`\n  Beta Race:   ${addr2}`);
  console.log(`    Supply: ${beta_total}  |  Holders: 9  |  Transfers: 2`);
  console.log(`\n  Wallets created: 12`);
  console.log(`  Multi-race minters: Owner, W1, W3, W5, W6 (5 wallets)`);
  console.log(`  Alpha-only minters (churned): W2, W4, W7, W8`);
  console.log(`  Beta-only minters:  W9, W10, W11, W12`);
  console.log(`  Single-use (no transfer): W4, W5, W7, W8 (Alpha), W12 (Beta)`);
  console.log(`  Seller wallets:     Owner, W1, W2 (Alpha) | Owner, W10 (Beta)`);

  console.log("\n━━━ Dashboard .env Config ━━━");
  console.log(`VITE_NFT_CONTRACTS=Alpha Race:${addr1},Beta Race:${addr2}`);

  console.log("\n━━━ Expected Dashboard Metrics ━━━");
  console.log("  Sell Pressure:       Alpha 3/9 = 0.33 (Moderate), Beta 2/9 = 0.22 (Low)");
  console.log("  Churn Funnel:        5 of 9 Alpha minters return to Beta");
  console.log("  Return Rate:         ~55.6% Alpha → Beta (5/9)");
  console.log("  Single-Use Rate:     Alpha: 4/9 = 44%, Beta: 1/9 = 11%");
  console.log("  Multi-Race Holders:  5 wallets hold NFTs from both races");
  console.log("  Holder Growth:       Staggered mints show growth curve");
  console.log("  Time-to-Mint:        Varied delays per wallet");

  hederaClient.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
