require("dotenv").config();
const {
  Client,
  AccountCreateTransaction,
  PrivateKey,
  Hbar,
  AccountId,
} = require("@hashgraph/sdk");

/**
 * Creates new Hedera accounts using the Hedera SDK (AccountCreateTransaction).
 *
 * Usage: node scripts/createWallets.js
 * Set WALLET_COUNT in env to control how many wallets to create (default: 3).
 */
async function main() {
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);

  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  const count = parseInt(process.env.WALLET_COUNT || "3", 10);
  console.log(`Creating ${count} new accounts from ${operatorId}...\n`);

  const wallets = [];

  for (let i = 0; i < count; i++) {
    // Generate a new ECDSA key pair for the new account
    const newKey = PrivateKey.generateECDSA();
    const newPublicKey = newKey.publicKey;

    // Create the account with an initial balance
    const txResponse = await new AccountCreateTransaction()
      .setKey(newPublicKey)
      .setInitialBalance(new Hbar(5))
      .setAlias(newPublicKey.toEvmAddress())
      .execute(client);

    const receipt = await txResponse.getReceipt(client);
    const newAccountId = receipt.accountId;
    const evmAddress = newPublicKey.toEvmAddress();

    console.log(`Wallet ${i + 1}:`);
    console.log(`  Account ID:  ${newAccountId}`);
    console.log(`  EVM Address: 0x${evmAddress}`);
    console.log(`  Private Key: ${newKey.toStringRaw()}`);
    console.log(`  Balance:     5 HBAR`);

    wallets.push({
      accountId: newAccountId.toString(),
      evmAddress: `0x${evmAddress}`,
      privateKey: newKey.toStringRaw(),
    });
  }

  console.log("\n--- Created Wallets ---");
  console.log(JSON.stringify(wallets, null, 2));
  console.log("\nSave these addresses to use in mint/transfer scripts.");

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
