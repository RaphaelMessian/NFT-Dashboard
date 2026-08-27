/**
 * Shared helper: compute the chronological time-since-previous-mint (ms)
 * for a list of mint documents. Used both by the incremental sync (which
 * recomputes it for a single contract's full history whenever that contract
 * gets a new mint) and by the one-off backfill script (which seeds it for
 * contracts that are already fully synced and would otherwise never hit
 * that code path again).
 */

/**
 * @param {Array<{_id, timestamp: Date|null, mintIntervalSec?: number|null}>} mints
 *   Mints for a SINGLE contract, already sorted by `timestamp` ascending.
 * @returns {Array} MongoDB bulkWrite ops for documents whose stored value
 *   differs from the freshly computed one (empty array if nothing changed).
 */
function computeMintIntervalOps(mints) {
  const ops = [];
  for (let i = 0; i < mints.length; i++) {
    const prevTs = i > 0 ? mints[i - 1].timestamp : null;
    const curTs = mints[i].timestamp;
    const intervalSec = prevTs && curTs ? (curTs.getTime() - prevTs.getTime()) / 1000 : null;
    if (mints[i].mintIntervalSec !== intervalSec) {
      ops.push({
        updateOne: {
          filter: { _id: mints[i]._id },
          update: { $set: { mintIntervalSec: intervalSec } },
        },
      });
      mints[i].mintIntervalSec = intervalSec; // keep in-memory copy consistent
    }
  }
  return ops;
}

module.exports = { computeMintIntervalOps };
