/**
 * One-shot backfill: seeds mintIntervalSec (time since the previous mint of
 * the same contract) for mints stored before this field existed.
 *
 * Pure DB operation — no Mirror Node calls, so it's fast even on a large
 * history. Normally sync.js recomputes this automatically for a contract
 * whenever it gets a new mint, but its incremental "fast path" skips that
 * entirely for contracts with no new activity — which is most of them once
 * a collection has finished minting. This script seeds the field once so
 * historical data isn't left without it.
 *
 * Usage: node src/backfillMintIntervals.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const { connect, close, col } = require("./db");
const { computeMintIntervalOps } = require("./mintIntervals");

async function main() {
  const db = await connect();
  const contractIds = await col(db, "mints").distinct("contractId");
  console.log(`Found ${contractIds.length} contract(s) with mints\n`);

  let totalUpdated = 0;
  for (const contractId of contractIds) {
    const mints = await col(db, "mints")
      .find({ contractId })
      .sort({ timestamp: 1 })
      .toArray();

    const ops = computeMintIntervalOps(mints);
    if (ops.length > 0) {
      await col(db, "mints").bulkWrite(ops);
      totalUpdated += ops.length;
    }
    console.log(`  [${contractId}] ${mints.length} mint(s) — ${ops.length} updated`);
  }

  console.log(`\n✅ Done — ${totalUpdated} mint document(s) updated across ${contractIds.length} contract(s)`);
  await close();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
