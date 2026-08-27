/**
 * Shared Hedera Mirror Node client helpers.
 *
 * Centralizes the base URL and the global rate limiter, and exposes the
 * lookups needed to attach node/latency metadata to mint & transfer events.
 * Used by both the incremental sync (sync.js) and the one-shot backfill
 * script (backfillTransactionMeta.js).
 */

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com";

// ── Global rate limiter: min gap between Mirror Node requests ──
// Overridable via MIRROR_MIN_INTERVAL_MS env var — the incremental sync
// (sync.js) stays conservative by default, while one-off backfill scripts
// that need to churn through a large history can raise the throughput.
const MIRROR_MIN_INTERVAL_MS = parseInt(process.env.MIRROR_MIN_INTERVAL_MS || "250", 10);
let _lastRequestAt = 0;

async function fetchJson(url, retries = 5) {
  // Proactive throttle — wait until minimum interval has elapsed
  const now = Date.now();
  const gap = now - _lastRequestAt;
  if (gap < MIRROR_MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIRROR_MIN_INTERVAL_MS - gap));
  }
  _lastRequestAt = Date.now();

  let delay = 3000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
      console.warn(`  ⚠ 429 — waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries + 1})`);
      await new Promise((r) => setTimeout(r, wait));
      _lastRequestAt = Date.now();
      delay = Math.min(delay * 2, 60000);
      continue;
    }
    throw new Error(`Mirror ${res.status}: ${url}`);
  }
  throw new Error(`Mirror still 429 after ${retries} retries: ${url}`);
}

/**
 * Given the full-precision consensus timestamp string of a transaction
 * (e.g. as returned by /contracts/{id}/results/logs → log.timestamp),
 * fetch the transaction record and extract the consensus node that
 * processed it plus the timing fields needed to compute submission→
 * consensus latency.
 *
 * Returns null if the mirror node has no matching transaction record.
 */
async function fetchTransactionMeta(consensusTimestamp) {
  const data = await fetchJson(
    `${MIRROR_BASE}/api/v1/transactions?timestamp=${consensusTimestamp}`
  );
  const tx = (data.transactions || [])[0];
  if (!tx) return null;

  const consensus = parseFloat(tx.consensus_timestamp);
  const validStart = parseFloat(tx.valid_start_timestamp);

  return {
    nodeId: tx.node || null,
    consensusTimestamp: tx.consensus_timestamp,
    validStartTimestamp: tx.valid_start_timestamp,
    // Time from client-submitted valid_start to network consensus, in seconds
    // (rounded to millisecond precision to avoid float noise from the subtraction).
    latencySec:
      Number.isFinite(consensus) && Number.isFinite(validStart)
        ? Math.round((consensus - validStart) * 1000) / 1000
        : null,
  };
}

/**
 * Recover the full-precision consensus timestamp of a transaction from its
 * hash alone. Needed to backfill old mints/transfers, which were stored
 * with only a millisecond-precision Date — not enough precision to look
 * the transaction up via ?timestamp=.
 */
async function fetchConsensusTimestampForHash(transactionHash) {
  try {
    const data = await fetchJson(
      `${MIRROR_BASE}/api/v1/contracts/results/${transactionHash}`
    );
    return data.timestamp || null;
  } catch {
    return null;
  }
}

module.exports = {
  MIRROR_BASE,
  fetchJson,
  fetchTransactionMeta,
  fetchConsensusTimestampForHash,
};
