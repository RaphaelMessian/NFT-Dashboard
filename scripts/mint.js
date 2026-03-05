const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Set NFT_CONTRACT_ADDRESS in your .env file first (run deploy)");
  }

  const [owner] = await hre.ethers.getSigners();
  const nft = await hre.ethers.getContractAt("LaunchNFT", contractAddress);

  // Mint to the deployer/owner by default
  const mintTo = process.env.MINT_TO || owner.address;
  const count = parseInt(process.env.MINT_COUNT || "1", 10);

  console.log(`Minting ${count} NFT(s) to ${mintTo}...`);

  if (count === 1) {
    const tx = await nft.mint(mintTo);
    const receipt = await tx.wait();
    console.log("Minted 1 NFT. Tx hash:", receipt.hash);
  } else {
    const tx = await nft.mintBatch(mintTo, count);
    const receipt = await tx.wait();
    console.log(`Minted ${count} NFTs. Tx hash:`, receipt.hash);
  }

  const nextId = await nft.nextTokenId();
  console.log("Next token ID:", nextId.toString());
  console.log("Total supply:", (await nft.totalSupply()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
