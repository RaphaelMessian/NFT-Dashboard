/**
 * Cross-race and per-race analytics computations.
 *
 * A "race" maps 1:1 to an NFT contract. Contracts are ordered
 * as they appear in VITE_NFT_CONTRACTS (Race 1, Race 2, ...).
 */

// ────────────────────────────────────────────────────
// 1. Time to Mint
//    Delta between the minter's account creation timestamp
//    and their first mint timestamp for a given contract.
// ────────────────────────────────────────────────────

/**
 * Compute time-to-mint for each unique minter in a contract.
 *
 * @param {{ to: string, timestamp: Date }[]} mints — decoded mint events
 * @param {Map<string, Date>} accountCreationMap — address → account creation Date
 * @returns {{ address: string, createdAt: Date, firstMintAt: Date, deltaMs: number, deltaSec: number }[]}
 */
export function computeTimeToMint(mints, accountCreationMap) {
  // Find first mint per address
  const firstMintByAddr = new Map();
  for (const m of mints) {
    const addr = m.to.toLowerCase();
    if (!firstMintByAddr.has(addr) || m.timestamp < firstMintByAddr.get(addr)) {
      firstMintByAddr.set(addr, m.timestamp);
    }
  }

  const results = [];
  for (const [addr, firstMint] of firstMintByAddr) {
    const created = accountCreationMap.get(addr);
    if (!created || !firstMint) continue;
    const deltaMs = firstMint.getTime() - created.getTime();
    results.push({
      address: addr,
      createdAt: created,
      firstMintAt: firstMint,
      deltaMs,
      deltaSec: deltaMs / 1000,
    });
  }

  results.sort((a, b) => a.deltaSec - b.deltaSec);
  return results;
}

/**
 * Summarise time-to-mint results into avg / median / min / max.
 * @param {{ deltaSec: number }[]} ttmEntries
 */
export function summariseTimeToMint(ttmEntries) {
  if (ttmEntries.length === 0) {
    return { avg: 0, median: 0, min: 0, max: 0, count: 0 };
  }

  const sorted = [...ttmEntries].sort((a, b) => a.deltaSec - b.deltaSec);
  const secs = sorted.map((e) => e.deltaSec);
  const sum = secs.reduce((a, b) => a + b, 0);

  return {
    avg: sum / secs.length,
    median: secs[Math.floor(secs.length / 2)],
    min: secs[0],
    max: secs[secs.length - 1],
    count: secs.length,
  };
}

/**
 * Format seconds into a human-readable string.
 */
export function formatDuration(totalSec) {
  if (totalSec < 0) return "N/A";
  const abs = Math.abs(totalSec);
  if (abs < 60) return `${Math.round(abs)}s`;
  if (abs < 3600) return `${Math.round(abs / 60)}m`;
  if (abs < 86400) return `${(abs / 3600).toFixed(1)}h`;
  return `${(abs / 86400).toFixed(1)}d`;
}

// ────────────────────────────────────────────────────
// 2. User Return Rate
//    Fraction of Race-N minters that also minted in Race N+1.
// ────────────────────────────────────────────────────

/**
 * Compute return rate between consecutive races.
 *
 * @param {Set<string>[]} minterSets — array of Sets of minter addresses,
 *                                      one per race in order.
 * @returns {{ from: number, to: number, prevCount: number, returnedCount: number, rate: number }[]}
 */
export function computeReturnRates(minterSets) {
  const rates = [];
  for (let i = 0; i < minterSets.length - 1; i++) {
    const prev = minterSets[i];
    const next = minterSets[i + 1];
    let returned = 0;
    for (const addr of prev) {
      if (next.has(addr)) returned++;
    }
    rates.push({
      from: i + 1,
      to: i + 2,
      prevCount: prev.size,
      returnedCount: returned,
      rate: prev.size > 0 ? returned / prev.size : 0,
    });
  }
  return rates;
}

// ────────────────────────────────────────────────────
// 3. Cumulative Unique Minters
// ────────────────────────────────────────────────────

/**
 * Compute the cumulative unique minter count across races.
 *
 * @param {Set<string>[]} minterSets — one per race in order.
 * @returns {{ race: number, newMinters: number, cumulativeUnique: number }[]}
 */
export function computeCumulativeUniqueMinters(minterSets) {
  const seen = new Set();
  return minterSets.map((set, i) => {
    let newMinters = 0;
    for (const addr of set) {
      if (!seen.has(addr)) {
        seen.add(addr);
        newMinters++;
      }
    }
    return {
      race: i + 1,
      newMinters,
      cumulativeUnique: seen.size,
    };
  });
}

// ────────────────────────────────────────────────────
// 4. Lapsed Wallet Reactivation
//    Wallets that minted in race ≤ N-2, skipped race N-1,
//    and minted again in race N.
// ────────────────────────────────────────────────────

/**
 * Compute lapsed-wallet reactivation for each race (from race 3 onward).
 *
 * A wallet is "lapsed-reactivated" in race R if:
 *   - it minted in at least one race before R-1
 *   - it did NOT mint in the immediately preceding race R-1
 *   - it minted in race R
 *
 * @param {Set<string>[]} minterSets
 * @returns {{ race: number, reactivatedCount: number, reactivated: string[] }[]}
 */
export function computeLapsedReactivation(minterSets) {
  const results = [];
  for (let r = 2; r < minterSets.length; r++) {
    // Build set of all wallets that minted in any race before r-1 (i.e. 0..r-2)
    const olderMinters = new Set();
    for (let j = 0; j < r - 1; j++) {
      for (const addr of minterSets[j]) olderMinters.add(addr);
    }

    const prevRace = minterSets[r - 1];
    const currentRace = minterSets[r];

    const reactivated = [];
    for (const addr of currentRace) {
      if (olderMinters.has(addr) && !prevRace.has(addr)) {
        reactivated.push(addr);
      }
    }

    results.push({
      race: r + 1,
      reactivatedCount: reactivated.length,
      reactivated,
    });
  }
  return results;
}

// ────────────────────────────────────────────────────
// 5. Mint Velocity
//    Mints per time bucket (hourly) — shows demand spikes.
// ────────────────────────────────────────────────────

/**
 * Build mint-velocity data: mints bucketed by hour.
 *
 * @param {{ timestamp: Date }[]} mints
 * @returns {{ time: string, hour: string, count: number }[]}
 */
export function buildMintVelocity(mints) {
  const buckets = {};
  for (const m of mints) {
    if (!m.timestamp) continue;
    // Bucket to the hour
    const d = new Date(m.timestamp);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    if (!buckets[key]) {
      buckets[key] = {
        time: key,
        hour: d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        count: 0,
      };
    }
    buckets[key].count++;
  }
  return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time));
}

// ────────────────────────────────────────────────────
// 6. Hold Duration & Flipper Detection
//    Time between receiving an NFT (mint or transfer-in)
//    and transferring it away. Short hold = flipper.
// ────────────────────────────────────────────────────

/**
 * Compute hold durations for all tokens that have been transferred away
 * from their recipient (mint or transfer-in → transfer-out).
 *
 * @param {{ to: string, tokenId: number, timestamp: Date, isMint: boolean }[]} mints
 * @param {{ from: string, to: string, tokenId: number, timestamp: Date }[]} transfers
 * @param {number} flipThresholdSec — max hold time (seconds) to flag as flipper (default 300 = 5min)
 * @returns {{ holdDurations: { address, tokenId, receivedAt, sentAt, holdSec }[], flippers: { address, flipCount, avgHoldSec }[], avgHoldSec: number }}
 */
export function computeHoldDurations(mints, transfers, flipThresholdSec = 300) {
  // Build a map of tokenId → list of "received" events (time a wallet got the token)
  // receivedAt comes from mints (to-address) and transfers (to-address)
  const receivedEvents = {}; // tokenId → [{ address, timestamp }]
  for (const m of mints) {
    if (!receivedEvents[m.tokenId]) receivedEvents[m.tokenId] = [];
    receivedEvents[m.tokenId].push({
      address: m.to.toLowerCase(),
      timestamp: m.timestamp,
    });
  }
  for (const t of transfers) {
    if (!receivedEvents[t.tokenId]) receivedEvents[t.tokenId] = [];
    receivedEvents[t.tokenId].push({
      address: t.to.toLowerCase(),
      timestamp: t.timestamp,
    });
  }

  const holdDurations = [];

  // For each transfer-out, find the matching received event
  for (const t of transfers) {
    const fromAddr = t.from.toLowerCase();
    const events = receivedEvents[t.tokenId];
    if (!events) continue;

    // Find the latest received event for this address + tokenId that is BEFORE the transfer-out
    let bestReceived = null;
    for (const ev of events) {
      if (
        ev.address === fromAddr &&
        ev.timestamp &&
        t.timestamp &&
        ev.timestamp <= t.timestamp
      ) {
        if (!bestReceived || ev.timestamp > bestReceived.timestamp) {
          bestReceived = ev;
        }
      }
    }

    if (bestReceived && t.timestamp) {
      const holdSec =
        (t.timestamp.getTime() - bestReceived.timestamp.getTime()) / 1000;
      holdDurations.push({
        address: fromAddr,
        tokenId: t.tokenId,
        receivedAt: bestReceived.timestamp,
        sentAt: t.timestamp,
        holdSec,
      });
    }
  }

  // Avg hold duration
  const avgHoldSec =
    holdDurations.length > 0
      ? holdDurations.reduce((s, h) => s + h.holdSec, 0) / holdDurations.length
      : 0;

  // Flipper detection: wallets with at least 1 hold under the threshold
  const flipperMap = {}; // address → { count, totalHold }
  for (const h of holdDurations) {
    if (h.holdSec <= flipThresholdSec) {
      if (!flipperMap[h.address]) {
        flipperMap[h.address] = { count: 0, totalHold: 0 };
      }
      flipperMap[h.address].count++;
      flipperMap[h.address].totalHold += h.holdSec;
    }
  }

  const flippers = Object.entries(flipperMap)
    .map(([address, { count, totalHold }]) => ({
      address,
      flipCount: count,
      avgHoldSec: totalHold / count,
    }))
    .sort((a, b) => b.flipCount - a.flipCount);

  return { holdDurations, flippers, avgHoldSec };
}

// ────────────────────────────────────────────────────
// 7. Multi-Race Holders
//    Wallets that currently hold NFTs from 2+ contracts.
// ────────────────────────────────────────────────────

/**
 * Find wallets that hold tokens across multiple races simultaneously.
 *
 * @param {{ address: string, tokenCount: number }[][]} holdersByRace
 *        — array (one per race) of holder objects.
 * @param {string[]} raceLabels — label per race.
 * @returns {{ address: string, raceCount: number, races: string[] }[]}
 */
export function computeMultiRaceHolders(holdersByRace, raceLabels) {
  const walletRaces = {}; // address → Set of race indices
  holdersByRace.forEach((holders, i) => {
    for (const h of holders) {
      const addr = h.address.toLowerCase();
      if (!walletRaces[addr]) walletRaces[addr] = new Set();
      walletRaces[addr].add(i);
    }
  });

  return Object.entries(walletRaces)
    .filter(([, races]) => races.size >= 2)
    .map(([address, races]) => ({
      address,
      raceCount: races.size,
      races: [...races].map((i) => raceLabels[i] || `Race ${i + 1}`),
    }))
    .sort((a, b) => b.raceCount - a.raceCount);
}

// ────────────────────────────────────────────────────
// 8. Gini Coefficient
//    Measures concentration of NFT holdings.
//    0 = perfectly even, 1 = one wallet holds everything.
// ────────────────────────────────────────────────────

/**
 * Compute the Gini coefficient for a set of holders.
 *
 * @param {{ tokenCount: number }[]} holders
 * @returns {number} Gini coefficient between 0 and 1.
 */
export function computeGini(holders) {
  if (holders.length === 0) return 0;
  const counts = holders.map((h) => h.tokenCount).sort((a, b) => a - b);
  const n = counts.length;
  const totalTokens = counts.reduce((a, b) => a + b, 0);
  if (totalTokens === 0) return 0;

  // Gini = (2 * Σ(i * x_i)) / (n * Σ(x_i)) - (n + 1) / n
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * counts[i];
  }
  return (2 * weightedSum) / (n * totalTokens) - (n + 1) / n;
}

/**
 * Classify Gini into a human-readable distribution health label.
 * @param {number} gini
 * @returns {{ label: string, color: string }}
 */
export function classifyGini(gini) {
  if (gini < 0.2) return { label: "Very Even", color: "text-green-400" };
  if (gini < 0.4) return { label: "Moderate", color: "text-teal-400" };
  if (gini < 0.6) return { label: "Uneven", color: "text-amber-400" };
  if (gini < 0.8) return { label: "Concentrated", color: "text-orange-400" };
  return { label: "Highly Concentrated", color: "text-red-400" };
}

// ────────────────────────────────────────────────────
// 9. Funding Cluster / Sybil Detection
//    Groups wallets by creation-time proximity.
//    Wallets created within `windowSec` of each other
//    from the same funder likely belong to the same actor.
// ────────────────────────────────────────────────────

/**
 * Cluster wallet creation times to detect sybil patterns.
 * Wallets created within `windowSec` seconds of each other are grouped.
 *
 * @param {{ transactionId: string, timestamp: Date }[]} creations
 *        — from fetchAccountCreations()
 * @param {number} windowSec — clustering window in seconds (default 60)
 * @returns {{ clusters: { startTime: Date, endTime: Date, count: number, txIds: string[] }[], suspiciousCount: number }}
 */
export function detectFundingClusters(creations, windowSec = 60) {
  if (creations.length === 0) return { clusters: [], suspiciousCount: 0 };

  // Sort by timestamp
  const sorted = [...creations]
    .filter((c) => c.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp);

  const clusters = [];
  let currentCluster = {
    startTime: sorted[0]?.timestamp,
    endTime: sorted[0]?.timestamp,
    count: 1,
    txIds: [sorted[0]?.transactionId],
  };

  for (let i = 1; i < sorted.length; i++) {
    const gap =
      (sorted[i].timestamp.getTime() - currentCluster.endTime.getTime()) / 1000;
    if (gap <= windowSec) {
      // Extend current cluster
      currentCluster.endTime = sorted[i].timestamp;
      currentCluster.count++;
      currentCluster.txIds.push(sorted[i].transactionId);
    } else {
      // Start new cluster
      if (currentCluster.count >= 2) clusters.push(currentCluster);
      currentCluster = {
        startTime: sorted[i].timestamp,
        endTime: sorted[i].timestamp,
        count: 1,
        txIds: [sorted[i].transactionId],
      };
    }
  }
  // Don't forget the last cluster
  if (currentCluster.count >= 2) clusters.push(currentCluster);

  // Suspicious = clusters of 3+ wallets
  const suspiciousCount = clusters.filter((c) => c.count >= 3).length;

  return { clusters, suspiciousCount };
}

// ────────────────────────────────────────────────────
// 10. Whale Watchlist
//     Top N holders with % of total supply.
// ────────────────────────────────────────────────────

/**
 * Build a whale watchlist: top holders ranked by token count.
 *
 * @param {{ address: string, tokenCount: number }[]} holders
 * @param {number} totalSupply — total minted tokens
 * @param {number} topN — how many to return (default 10)
 * @returns {{ address: string, tokenCount: number, pctSupply: number }[]}
 */
export function buildWhaleWatchlist(holders, totalSupply, topN = 10) {
  const sorted = [...holders].sort((a, b) => b.tokenCount - a.tokenCount);
  return sorted.slice(0, topN).map((h) => ({
    address: h.address,
    tokenCount: h.tokenCount,
    pctSupply: totalSupply > 0 ? (h.tokenCount / totalSupply) * 100 : 0,
  }));
}

// ────────────────────────────────────────────────────
// 11. Token Velocity
//     Average number of transfers per token.
// ────────────────────────────────────────────────────

/**
 * Compute token velocity: average transfers per minted token.
 *
 * @param {{ tokenId: number }[]} transfers
 * @param {number} totalMinted
 * @returns {{ velocity: number, maxTokenTransfers: number, tokenTransferCounts: { tokenId: number, count: number }[] }}
 */
export function computeTokenVelocity(transfers, totalMinted) {
  const counts = {};
  for (const t of transfers) {
    counts[t.tokenId] = (counts[t.tokenId] || 0) + 1;
  }

  const tokenTransferCounts = Object.entries(counts)
    .map(([tokenId, count]) => ({ tokenId: Number(tokenId), count }))
    .sort((a, b) => b.count - a.count);

  const maxTokenTransfers = tokenTransferCounts.length > 0 ? tokenTransferCounts[0].count : 0;
  const velocity = totalMinted > 0 ? transfers.length / totalMinted : 0;

  return { velocity, maxTokenTransfers, tokenTransferCounts };
}

// ────────────────────────────────────────────────────
// 12. Sell Pressure Index
//     Ratio of transfers to total mints. Higher = more dumping.
// ────────────────────────────────────────────────────

/**
 * Compute sell pressure: transfers / mints.
 *
 * @param {number} totalTransfers
 * @param {number} totalMints
 * @returns {{ pressure: number, label: string, color: string }}
 */
export function computeSellPressure(totalTransfers, totalMints) {
  if (totalMints === 0) return { pressure: 0, label: "No data", color: "text-gray-500" };
  const pressure = totalTransfers / totalMints;
  let label, color;
  if (pressure < 0.1) { label = "Very Low"; color = "text-green-400"; }
  else if (pressure < 0.3) { label = "Low"; color = "text-teal-400"; }
  else if (pressure < 0.6) { label = "Moderate"; color = "text-amber-400"; }
  else if (pressure < 1.0) { label = "High"; color = "text-orange-400"; }
  else { label = "Very High"; color = "text-red-400"; }
  return { pressure, label, color };
}

// ────────────────────────────────────────────────────
// 13. Mint Timing Heatmap
//     Grid of hour-of-day counts — reveals bot patterns.
// ────────────────────────────────────────────────────

/**
 * Build a mint-timing heatmap: count of mints per hour-of-day (0–23)
 * and per day-of-week (0=Sun – 6=Sat).
 *
 * @param {{ timestamp: Date }[]} mints
 * @returns {{ hourCounts: number[], dayHourGrid: number[][], peakHour: number, peakDay: number }}
 */
export function buildMintTimingHeatmap(mints) {
  const hourCounts = new Array(24).fill(0);
  // dayHourGrid[day][hour] = count
  const dayHourGrid = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const m of mints) {
    if (!m.timestamp) continue;
    const h = m.timestamp.getUTCHours();
    const d = m.timestamp.getUTCDay();
    hourCounts[h]++;
    dayHourGrid[d][h]++;
  }

  let peakHour = 0, peakDay = 0, peakVal = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (dayHourGrid[d][h] > peakVal) {
        peakVal = dayHourGrid[d][h];
        peakDay = d;
        peakHour = h;
      }
    }
  }

  return { hourCounts, dayHourGrid, peakHour, peakDay };
}

// ────────────────────────────────────────────────────
// 14. Single-Use Wallet Rate
//     % of wallets that minted exactly once and never transacted again.
// ────────────────────────────────────────────────────

/**
 * Compute single-use wallet rate.
 *
 * A wallet is "single-use" if it:
 * - Minted exactly 1 token
 * - Never made any outgoing transfers
 *
 * @param {{ to: string }[]} mints
 * @param {{ from: string }[]} transfers
 * @returns {{ singleUseCount: number, totalMinters: number, rate: number }}
 */
export function computeSingleUseWalletRate(mints, transfers) {
  // Count mints per wallet
  const mintCounts = {};
  for (const m of mints) {
    const addr = m.to.toLowerCase();
    mintCounts[addr] = (mintCounts[addr] || 0) + 1;
  }

  // Wallets that have transferred out at least once
  const hasTransferred = new Set();
  for (const t of transfers) {
    hasTransferred.add(t.from.toLowerCase());
  }

  const totalMinters = Object.keys(mintCounts).length;
  let singleUseCount = 0;
  for (const [addr, count] of Object.entries(mintCounts)) {
    if (count === 1 && !hasTransferred.has(addr)) {
      singleUseCount++;
    }
  }

  return {
    singleUseCount,
    totalMinters,
    rate: totalMinters > 0 ? singleUseCount / totalMinters : 0,
  };
}

// ────────────────────────────────────────────────────
// 15. Holder Growth Over Time
//     Unique holders per day, computed from Transfer events.
// ────────────────────────────────────────────────────

/**
 * Build a daily holder-count series from mint and transfer events.
 *
 * @param {{ to: string, from: string, isMint: boolean, timestamp: Date }[]} allEvents
 *        — combined mint + transfer events, with isMint flag
 * @returns {{ date: string, holders: number }[]}
 */
export function buildHolderGrowth(mints, transfers) {
  // Combine & sort all events by timestamp
  const events = [
    ...mints.map((m) => ({ ...m, isMint: true })),
    ...transfers.map((t) => ({ ...t, isMint: false })),
  ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const holderBalances = {}; // address → count of tokens held
  const dailySeries = [];
  let currentDay = null;
  let holderCount = 0;

  const updateHolder = (addr, delta) => {
    const a = addr.toLowerCase();
    const prev = holderBalances[a] || 0;
    const next = prev + delta;
    if (prev === 0 && next > 0) holderCount++;
    if (prev > 0 && next <= 0) holderCount--;
    holderBalances[a] = Math.max(0, next);
  };

  for (const ev of events) {
    if (!ev.timestamp) continue;
    const day = ev.timestamp.toISOString().split("T")[0];

    if (day !== currentDay) {
      if (currentDay) {
        dailySeries.push({ date: currentDay, holders: holderCount });
      }
      currentDay = day;
    }

    // Update balances
    if (ev.from && ev.from !== "0x0000000000000000000000000000000000000000") {
      updateHolder(ev.from, -1);
    }
    if (ev.to && ev.to !== "0x0000000000000000000000000000000000000000") {
      updateHolder(ev.to, 1);
    }
  }

  // Push final day
  if (currentDay) {
    dailySeries.push({ date: currentDay, holders: holderCount });
  }

  return dailySeries;
}

// ────────────────────────────────────────────────────
// 16. Churn Funnel
//     Visualise drop-off: Race 1 minters → Race 2 → Race 3…
// ────────────────────────────────────────────────────

/**
 * Build a churn funnel from Race 1 minters.
 * For each subsequent race, count how many of the Race 1 minters are still active.
 *
 * @param {Set<string>[]} minterSets — one per race
 * @returns {{ race: number, retained: number, pct: number }[]}
 */
export function buildChurnFunnel(minterSets) {
  if (minterSets.length === 0) return [];
  const race1 = minterSets[0];
  if (race1.size === 0) return [];

  return minterSets.map((set, i) => {
    let retained = 0;
    for (const addr of race1) {
      if (set.has(addr)) retained++;
    }
    return {
      race: i + 1,
      retained,
      pct: (retained / race1.size) * 100,
    };
  });
}
