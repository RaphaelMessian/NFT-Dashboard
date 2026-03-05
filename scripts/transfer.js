const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Set NFT_CONTRACT_ADDRESS in your .env file first");
  }

  const toAddress = process.env.TRANSFER_TO;
  const tokenId = process.env.TRANSFER_TOKEN_ID;

  if (!toAddress || !tokenId) {
    throw new Error(
      "Set TRANSFER_TO (recipient EVM address) and TRANSFER_TOKEN_ID in env or .env"
    );
  }

  const [owner] = await hre.ethers.getSigners();
  const nft = await hre.ethers.getContractAt("LaunchNFT", contractAddress);

  console.log(`Transferring token #${tokenId} from ${owner.address} to ${toAddress}...`);

  const tx = await nft.transferFrom(owner.address, toAddress, tokenId);
  const receipt = await tx.wait();

  console.log("Transfer complete. Tx hash:", receipt.hash);
  console.log("New owner of token #" + tokenId + ":", await nft.ownerOf(tokenId));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
