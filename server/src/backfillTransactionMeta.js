/**
 * One-shot backfill: adds nodeId / consensusTimestamp / validStartTimestamp /
 * latencySec to mints & transfers that were synced before this feature
 * existed (they only have a millisecond-precision `timestamp` Date, not the
 * full-precision consensus timestamp needed to look the node up directly).
 *
 * For each distinct transactionHash missing this data:
 *   1. GET /api/v1/contracts/results/{hash}  → recover full-precision timestamp
 *   2. GET /api/v1/transactions?timestamp=X  → node, consensus & valid-start ts
 * Results are cached per transactionHash so batch mints/transfers (several
 * tokenIds, same transaction) only cost 2 Mirror Node calls total, not 2×N.
 *
 * Usage:
 *   node src/backfillTransactionMeta.js
 *
 * Reads MONGO_URI from ../.env (same as sync.js).
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

// This script does 2 Mirror Node calls per unique transaction and there can
// be tens of thousands of them, so it runs faster than the default 4 req/s
// used by the live sync (~13 req/s here, still comfortably under the public
// mirror node's fair-use ceiling). Must be set before requiring mirrorClient.
process.env.MIRROR_MIN_INTERVAL_MS = process.env.MIRROR_MIN_INTERVAL_MS || "75";

const { connect, close, col } = require("./db");
const { fetchTransactionMeta, fetchConsensusTimestampForHash } = require("./mirrorClient");

async function backfillCollection(db, name) {
  const docs = await col(db, name)
    .find(
      { nodeId: { $exists: false }, transactionHash: { $exists: true, $ne: null } },
      { projection: { transactionHash: 1 } }
    )
    .toArray();

  console.log(`\n[${name}] ${docs.length} document(s) missing nodeId`);
  if (docs.length === 0) return;

  const hashCache = new Map(); // transactionHash -> meta | null
  let done = 0;
  let updated = 0;

  for (const doc of docs) {
    let meta = hashCache.get(doc.transactionHash);
    if (meta === undefined) {
      const rawTimestamp = await fetchConsensusTimestampForHash(doc.transactionHash);
      meta = rawTimestamp ? await fetchTransactionMeta(rawTimestamp).catch(() => null) : null;
      hashCache.set(doc.transactionHash, meta);
    }

    if (meta) {
      await col(db, name).updateOne({ _id: doc._id }, { $set: meta });
      updated++;
    }

    done++;
    if (done % 50 === 0 || done === docs.length) {
      console.log(`  [${name}] ${done}/${docs.length} processed (${hashCache.size} unique tx, ${updated} updated)`);
    }
  }

  console.log(`[${name}] done — ${updated}/${docs.length} document(s) updated, ${hashCache.size} unique transaction(s) resolved`);
}

async function main() {
  const db = await connect();
  await backfillCollection(db, "mints");
  await backfillCollection(db, "transfers");
  await close();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
