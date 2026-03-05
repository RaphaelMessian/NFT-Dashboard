const hre = require("hardhat");
const {
  Client,
  AccountCreateTransaction,
  PrivateKey,
  Hbar,
  AccountId,
} = require("@hashgraph/sdk");

/**
 * Demo script: deploys the contract, creates wallets, mints, and transfers
 * to generate activity for the dashboard.
 *
 * Usage: npx hardhat run scripts/demo.js --network hedera_testnet
 */
async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("=== NFT Launch Demo ===\n");
  console.log("Owner:", owner.address);

  // Set up Hedera SDK client for account creation
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);
  const hederaClient = Client.forTestnet().setOperator(operatorId, operatorKey);

  // 1. Deploy
  console.log("\n--- Step 1: Deploy LaunchNFT ---");
  const LaunchNFT = await hre.ethers.getContractFactory("LaunchNFT");
  const nft = await LaunchNFT.deploy("Launch NFT", "LNFT", "https://example.com/metadata/");
  await nft.waitForDeployment();
  const contractAddr = await nft.getAddress();
  console.log("Contract deployed at:", contractAddr);

  // 2. Create wallets using Hedera SDK
  console.log("\n--- Step 2: Create 3 Wallets (Hedera SDK) ---");
  const wallets = [];
  const walletKeys = [];
  for (let i = 0; i < 3; i++) {
    const newKey = PrivateKey.generateECDSA();
    const evmAddress = `0x${newKey.publicKey.toEvmAddress()}`;

    const txResponse = await new AccountCreateTransaction()
      .setKey(newKey.publicKey)
      .setInitialBalance(new Hbar(10))
      .setAlias(newKey.publicKey.toEvmAddress())
      .execute(hederaClient);

    const receipt = await txResponse.getReceipt(hederaClient);
    const newAccountId = receipt.accountId;

    // Create an ethers wallet connected to the provider for later use
    const w = new hre.ethers.Wallet(newKey.toStringRaw(), hre.ethers.provider);
    wallets.push(w);
    walletKeys.push({ accountId: newAccountId.toString(), evmAddress });
    console.log(`Wallet ${i + 1}: ${evmAddress} (Account ${newAccountId}, funded 10 HBAR)`);
  }

  // 3. Mint NFTs to owner
  console.log("\n--- Step 3: Mint 4 NFTs to owner ---");
  let tx = await nft.mintBatch(owner.address, 4);
  await tx.wait();
  console.log("Minted tokens #1 through #5 to owner");

  // 4. Mint NFTs to wallets
  console.log("\n--- Step 4: Mint NFTs to wallets ---");
  for (let i = 0; i < wallets.length; i++) {
    tx = await nft.mintBatch(wallets[i].address, 2);
    await tx.wait();
    console.log(`Minted 2 NFTs to wallet ${i + 1} (${wallets[i].address})`);
  }

  // 5. Transfer some NFTs between wallets
  console.log("\n--- Step 5: Transfer NFTs ---");
  // Owner transfers token #1 to wallet 1
  tx = await nft.transferFrom(owner.address, wallets[0].address, 1);
  await tx.wait();
  console.log(`Transferred token #1: owner -> wallet 1`);

  // Owner transfers token #2 to wallet 2
  tx = await nft.transferFrom(owner.address, wallets[1].address, 2);
  await tx.wait();
  console.log(`Transferred token #2: owner -> wallet 2`);

  // Wallet 1 transfers token #1 to wallet 3
  const nftFromWallet1 = nft.connect(wallets[0]);
  tx = await nftFromWallet1.transferFrom(wallets[0].address, wallets[2].address, 1);
  await tx.wait();
  console.log(`Transferred token #1: wallet 1 -> wallet 3`);

  // 6. Summary
  console.log("\n=== Demo Summary ===");
  console.log("Contract address:", contractAddr);
  console.log("Total supply:", (await nft.totalSupply()).toString());
  console.log("Owner balance:", (await nft.balanceOf(owner.address)).toString());
  for (let i = 0; i < wallets.length; i++) {
    const bal = await nft.balanceOf(wallets[i].address);
    console.log(`Wallet ${i + 1} (${wallets[i].address}) balance: ${bal.toString()}`);
  }

  console.log("\n--- Dashboard Config ---");
  console.log(`NFT_CONTRACT_ADDRESS=${contractAddr}`);
  console.log(`\nVisit: https://hashscan.io/testnet/contract/${contractAddr}`);
  console.log("Copy the contract address to dashboard/.env for monitoring.\n");

  hederaClient.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
