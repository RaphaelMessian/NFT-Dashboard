const hre = require("hardhat");

async function main() {
  console.log("Deploying LaunchNFT to Hedera Testnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "HBAR\n");

  const LaunchNFT = await hre.ethers.getContractFactory("LaunchNFT");
  const nft = await LaunchNFT.deploy(
    "Launch NFT",           // name
    "LNFT",                 // symbol
    "https://example.com/metadata/"  // baseURI
  );

  await nft.waitForDeployment();
  const address = await nft.getAddress();

  console.log("LaunchNFT deployed to:", address);
  console.log("\n--- IMPORTANT ---");
  console.log("Add this to your .env file:");
  console.log(`NFT_CONTRACT_ADDRESS=${address}`);
  console.log("\nYou can find the Hedera contract ID on the mirror node:");
  console.log(`https://hashscan.io/testnet/contract/${address}`);
  console.log("-----------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
