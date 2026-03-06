/**
 * Hedera Mirror Node → MongoDB sync script.
 *
 * Fetches on-chain data for every configured NFT contract,
 * computes all analytics, and stores a point-in-time snapshot
 * in MongoDB so reports can be generated later.
 *
 * Usage:
 *   node src/sync.js                  # one-shot sync
 *   node src/sync.js --reset          # drop DB first
 *
 * Reads VITE_NFT_CONTRACTS and VITE_ACCOUNT_ID from ../.env
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const { connect, close, col, ensureIndexes } = require("./db");

// ── Mirror Node helpers (server-side, no ES modules) ──────────

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mirror ${res.status}: ${url}`);
  return res.json();
}

async function fetchTransferLogs(contractId) {
  const logs = [];
  let url =
    `${MIRROR_BASE}/api/v1/contracts/${contractId}/results/logs?order=asc&limit=100`;
  while (url) {
    const data = await fetchJson(url);
    const filtered = (data.logs || []).filter(
      (l) => l.topics && l.topics[0] === TRANSFER_TOPIC
    );
    logs.push(...filtered);
    url = data.links?.next ? `${MIRROR_BASE}${data.links.next}` : null;
  }
  return logs;
}

function decodeLog(log) {
  const topics = log.topics || [];
  return {
    from: ("0x" + (topics[1] || "").slice(26)).toLowerCase(),
    to: ("0x" + (topics[2] || "").slice(26)).toLowerCase(),
    tokenId: parseInt(topics[3], 16),
    isMint: topics[1] === ZERO_TOPIC,
    timestamp: log.timestamp ? new Date(parseFloat(log.timestamp) * 1000) : null,
    blockNumber: log.block_number,
    transactionHash: log.transaction_hash,
  };
}

function processLogs(rawLogs) {
  const mints = [];
  const transfers = [];
  const balances = {};

  for (const log of rawLogs) {
    const d = decodeLog(log);
    if (d.isMint) mints.push(d);
    else transfers.push(d);

    if (d.from !== "0x0000000000000000000000000000000000000000") {
      if (balances[d.from]) {
        balances[d.from].delete(d.tokenId);
        if (balances[d.from].size === 0) delete balances[d.from];
      }
    }
    if (d.to !== "0x0000000000000000000000000000000000000000") {
      if (!balances[d.to]) balances[d.to] = new Set();
      balances[d.to].add(d.tokenId);
    }
  }

  const holders = Object.entries(balances)
    .map(([address, ids]) => ({ address, tokenCount: ids.size, tokenIds: [...ids] }))
    .sort((a, b) => b.tokenCount - a.tokenCount);

  return { mints, transfers, holders };
}

async function fetchAccountCreations(accountId) {
  const creations = [];
  // Don't filter by transactiontype server-side: lazy-creation (HIP-32) generates
  // CRYPTOCREATEACCOUNT as a child transaction (nonce=1) whose transfers list does
  // not contain the payer, so the mirror node ignores the account.id filter for them.
  // Instead, fetch all transactions from the account and filter client-side.
  let url = `${MIRROR_BASE}/api/v1/transactions?account.id=${accountId}&order=asc&limit=100`;
  while (url) {
    const data = await fetchJson(url);
    for (const tx of data.transactions || []) {
      if (tx.name === "CRYPTOCREATEACCOUNT" && tx.result === "SUCCESS") {
        creations.push({
          transactionId: tx.transaction_id,
          timestamp: tx.consensus_timestamp
            ? new Date(parseFloat(tx.consensus_timestamp) * 1000)
            : null,
          result: tx.result,
          entityId: tx.entity_id,
        });
      }
    }
    url = data.links?.next ? `${MIRROR_BASE}${data.links.next}` : null;
  }
  return creations;
}

async function fetchContractInfo(contractId) {
  try {
    return await fetchJson(`${MIRROR_BASE}/api/v1/contracts/${contractId}`);
  } catch {
    return null;
  }
}

async function fetchAccountInfo(addr) {
  try {
    return await fetchJson(`${MIRROR_BASE}/api/v1/accounts/${addr}`);
  } catch {
    return null;
  }
}

async function fetchAccountCreationTimestamps(addresses) {
  const map = {};
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const BATCH = 10;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (addr) => {
        const info = await fetchAccountInfo(addr);
        if (info?.created_timestamp) {
          return [addr, new Date(parseFloat(info.created_timestamp) * 1000)];
        }
        return [addr, null];
      })
    );
    for (const [addr, ts] of results) {
      if (ts) map[addr] = ts;
    }
  }
  return map;
}

// ── Analytics (inline, no ES module deps) ─────────────────────

function computeGini(holders) {
  const values = holders.map((h) => h.tokenCount).sort((a, b) => a - b);
  const n = values.length;
  if (n === 0) return 0;
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (2 * (i + 1) - n - 1) * values[i];
  return sum / (n * total);
}

function classifyGini(g) {
  if (g < 0.2) return { label: "Very Even", color: "green" };
  if (g < 0.4) return { label: "Moderate", color: "yellow" };
  if (g < 0.6) return { label: "Uneven", color: "orange" };
  return { label: "Concentrated", color: "red" };
}

function computeSellPressure(totalTransfers, totalMints) {
  if (totalMints === 0) return { pressure: 0, label: "No data" };
  const pressure = totalTransfers / totalMints;
  let label;
  if (pressure < 0.1) label = "Very Low";
  else if (pressure < 0.3) label = "Low";
  else if (pressure < 0.6) label = "Moderate";
  else if (pressure < 1.0) label = "High";
  else label = "Very High";
  return { pressure, label };
}

function computeTokenVelocity(transfers, totalMinted) {
  const counts = {};
  for (const t of transfers) counts[t.tokenId] = (counts[t.tokenId] || 0) + 1;
  const entries = Object.entries(counts)
    .map(([tokenId, count]) => ({ tokenId: Number(tokenId), count }))
    .sort((a, b) => b.count - a.count);
  return {
    velocity: totalMinted > 0 ? transfers.length / totalMinted : 0,
    maxTokenTransfers: entries.length > 0 ? entries[0].count : 0,
    topTokens: entries.slice(0, 10),
  };
}

function computeSingleUseRate(mints, transfers) {
  const mintCounts = {};
  for (const m of mints) {
    const a = m.to.toLowerCase();
    mintCounts[a] = (mintCounts[a] || 0) + 1;
  }
  const hasTransferred = new Set(transfers.map((t) => t.from.toLowerCase()));
  const totalMinters = Object.keys(mintCounts).length;
  let singleUse = 0;
  for (const [addr, c] of Object.entries(mintCounts)) {
    if (c === 1 && !hasTransferred.has(addr)) singleUse++;
  }
  return {
    singleUseCount: singleUse,
    totalMinters,
    rate: totalMinters > 0 ? singleUse / totalMinters : 0,
  };
}

function buildWhaleWatchlist(holders, totalSupply, topN = 10) {
  return holders.slice(0, topN).map((h) => ({
    address: h.address,
    tokenCount: h.tokenCount,
    pctSupply: totalSupply > 0 ? (h.tokenCount / totalSupply) * 100 : 0,
  }));
}

function buildHolderGrowth(mints, transfers) {
  const events = [
    ...mints.map((m) => ({ ...m, _isMint: true })),
    ...transfers.map((t) => ({ ...t, _isMint: false })),
  ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const bal = {};
  const series = [];
  let curDay = null;
  let count = 0;

  const update = (addr, delta) => {
    const a = addr.toLowerCase();
    const prev = bal[a] || 0;
    const next = prev + delta;
    if (prev === 0 && next > 0) count++;
    if (prev > 0 && next <= 0) count--;
    bal[a] = Math.max(0, next);
  };

  for (const ev of events) {
    if (!ev.timestamp) continue;
    const day = ev.timestamp.toISOString().split("T")[0];
    if (day !== curDay) {
      if (curDay) series.push({ date: curDay, holders: count });
      curDay = day;
    }
    if (ev.from && ev.from !== "0x0000000000000000000000000000000000000000") update(ev.from, -1);
    if (ev.to && ev.to !== "0x0000000000000000000000000000000000000000") update(ev.to, 1);
  }
  if (curDay) series.push({ date: curDay, holders: count });

  return series;
}

function buildMintTimingHeatmap(mints) {
  const hourCounts = new Array(24).fill(0);
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const m of mints) {
    if (!m.timestamp) continue;
    const h = m.timestamp.getUTCHours();
    const d = m.timestamp.getUTCDay();
    hourCounts[h]++;
    grid[d][h]++;
  }
  let peakHour = 0, peakDay = 0, peakVal = 0;
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++)
      if (grid[d][h] > peakVal) { peakVal = grid[d][h]; peakDay = d; peakHour = h; }
  return { hourCounts, dayHourGrid: grid, peakHour, peakDay };
}

function computeReturnRates(minterSets) {
  const rates = [];
  for (let i = 0; i < minterSets.length - 1; i++) {
    const prev = minterSets[i];
    const next = minterSets[i + 1];
    let returned = 0;
    for (const addr of prev) if (next.has(addr)) returned++;
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

function computeMultiRaceHolders(holdersByRace, raceLabels) {
  const walletRaces = {};
  for (let i = 0; i < holdersByRace.length; i++) {
    for (const h of holdersByRace[i]) {
      const a = h.address.toLowerCase();
      if (!walletRaces[a]) walletRaces[a] = [];
      walletRaces[a].push(raceLabels[i]);
    }
  }
  return Object.entries(walletRaces)
    .filter(([, races]) => races.length > 1)
    .map(([address, races]) => ({ address, raceCount: races.length, races }))
    .sort((a, b) => b.raceCount - a.raceCount);
}

function buildChurnFunnel(minterSets) {
  if (minterSets.length === 0) return [];
  const race1 = minterSets[0];
  if (race1.size === 0) return [];
  return minterSets.map((set, i) => {
    let retained = 0;
    for (const addr of race1) if (set.has(addr)) retained++;
    return { race: i + 1, retained, pct: (retained / race1.size) * 100 };
  });
}

function detectFundingClusters(creations, windowSec = 60) {
  if (creations.length < 2) return { clusters: [], suspiciousCount: 0 };
  const sorted = [...creations]
    .filter((c) => c.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp);
  const clusters = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      (sorted[j].timestamp - sorted[i].timestamp) / 1000 <= windowSec
    ) j++;
    if (j - i >= 2) {
      clusters.push({
        count: j - i,
        startTime: sorted[i].timestamp,
        endTime: sorted[j - 1].timestamp,
      });
    }
    i = j;
  }
  return {
    clusters,
    suspiciousCount: clusters.filter((c) => c.count >= 3).length,
  };
}

function computeTimeToMint(mints, creationMap) {
  const firstMintByAddr = {};
  for (const m of mints) {
    const a = m.to.toLowerCase();
    if (!firstMintByAddr[a] || m.timestamp < firstMintByAddr[a]) {
      firstMintByAddr[a] = m.timestamp;
    }
  }
  const entries = [];
  for (const [addr, firstMint] of Object.entries(firstMintByAddr)) {
    const created = creationMap[addr];
    if (created && firstMint) {
      const deltaSec = (firstMint - created) / 1000;
      if (deltaSec >= 0) {
        entries.push({ address: addr, createdAt: created, firstMintAt: firstMint, deltaSec });
      }
    }
  }
  entries.sort((a, b) => a.deltaSec - b.deltaSec);
  return entries;
}

function summariseTimeToMint(entries) {
  if (entries.length === 0) return { avg: 0, median: 0, min: 0, max: 0, count: 0 };
  const vals = entries.map((e) => e.deltaSec);
  const sum = vals.reduce((s, v) => s + v, 0);
  const mid = Math.floor(vals.length / 2);
  return {
    avg: sum / vals.length,
    median: vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2,
    min: vals[0],
    max: vals[vals.length - 1],
    count: vals.length,
  };
}

function computeHoldDurations(mints, transfers, flipThresholdSec = 300) {
  const mintTime = {};
  for (const m of mints) mintTime[m.tokenId] = m.timestamp;
  const holdDurations = [];
  for (const t of transfers) {
    const minted = mintTime[t.tokenId];
    if (minted && t.timestamp) {
      const sec = (t.timestamp - minted) / 1000;
      holdDurations.push({ tokenId: t.tokenId, from: t.from, holdSec: sec });
    }
    mintTime[t.tokenId] = t.timestamp;
  }
  const flipperMap = {};
  for (const h of holdDurations) {
    if (h.holdSec <= flipThresholdSec) {
      const a = h.from.toLowerCase();
      if (!flipperMap[a]) flipperMap[a] = { address: a, flips: [], total: 0 };
      flipperMap[a].flips.push(h.holdSec);
      flipperMap[a].total += h.holdSec;
    }
  }
  const flippers = Object.values(flipperMap)
    .map((f) => ({ address: f.address, flipCount: f.flips.length, avgHoldSec: f.total / f.flips.length }))
    .sort((a, b) => b.flipCount - a.flipCount);
  const avgHoldSec =
    holdDurations.length > 0
      ? holdDurations.reduce((s, h) => s + h.holdSec, 0) / holdDurations.length
      : 0;
  return { holdDurations, flippers, avgHoldSec };
}

function buildMintVelocity(mints) {
  if (mints.length === 0) return [];
  const sorted = [...mints].filter((m) => m.timestamp).sort((a, b) => a.timestamp - b.timestamp);
  const buckets = {};
  for (const m of sorted) {
    const h = m.timestamp.toISOString().slice(0, 13);
    buckets[h] = (buckets[h] || 0) + 1;
  }
  let peak = 0;
  const data = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => {
      if (count > peak) peak = count;
      return { hour: hour.slice(5) + ":00", mints: count };
    });
  return data;
}

function buildDailyActivity(mints, transfers) {
  const dayMap = {};
  const add = (date, key) => {
    if (!date) return;
    const day = date.toISOString().split("T")[0];
    if (!dayMap[day]) dayMap[day] = { date: day, mints: 0, transfers: 0 };
    dayMap[day][key]++;
  };
  mints.forEach((m) => add(m.timestamp, "mints"));
  transfers.forEach((t) => add(t.timestamp, "transfers"));
  return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
}

function buildHolderDistribution(holders) {
  const ranges = [
    { label: "1 NFT", min: 1, max: 1 },
    { label: "2-5 NFTs", min: 2, max: 5 },
    { label: "6-10 NFTs", min: 6, max: 10 },
    { label: "11-25 NFTs", min: 11, max: 25 },
    { label: "26+ NFTs", min: 26, max: Infinity },
  ];
  return ranges
    .map((r) => ({
      name: r.label,
      count: holders.filter((h) => h.tokenCount >= r.min && h.tokenCount <= r.max).length,
    }))
    .filter((r) => r.count > 0);
}

// ── Config ────────────────────────────────────────────────

function parseContracts() {
  const raw = process.env.VITE_NFT_CONTRACTS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(":");
      if (idx === -1) return { label: entry, contractId: entry };
      return { label: entry.slice(0, idx), contractId: entry.slice(idx + 1) };
    });
}

// ── Main sync ─────────────────────────────────────────────

async function sync() {
  const contracts = parseContracts();
  const accountId = process.env.VITE_ACCOUNT_ID || "";

  if (contracts.length === 0) {
    throw new Error("No contracts configured in VITE_NFT_CONTRACTS");
  }

  console.log("╔══════════════════════════════════════╗");
  console.log("║   NFT Dashboard → MongoDB Sync       ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`Contracts: ${contracts.map((c) => c.label).join(", ")}`);
  console.log(`Account:   ${accountId}\n`);

  const db = await connect();

  // Handle --reset flag
  if (process.argv.includes("--reset")) {
    console.log("⚠ Resetting database...");
    await db.dropDatabase();
    console.log("Database dropped.\n");
  }

  await ensureIndexes(db);

  const snapshotId = new Date();

  // ── Per-contract data ──
  const contractResults = [];

  for (const c of contracts) {
    console.log(`\n━━━ ${c.label} (${c.contractId}) ━━━`);

    const [info, rawLogs] = await Promise.all([
      fetchContractInfo(c.contractId),
      fetchTransferLogs(c.contractId),
    ]);

    const processed = processLogs(rawLogs);
    console.log(
      `  Mints: ${processed.mints.length}  Transfers: ${processed.transfers.length}  Holders: ${processed.holders.length}`
    );

    // Store individual mints
    if (processed.mints.length > 0) {
      const mintDocs = processed.mints.map((m) => ({
        ...m,
        contractId: c.contractId,
        contractLabel: c.label,
        snapshotId,
      }));
      await col(db, "mints").insertMany(mintDocs);
      console.log(`  → ${mintDocs.length} mints stored`);
    }

    // Store individual transfers
    if (processed.transfers.length > 0) {
      const transferDocs = processed.transfers.map((t) => ({
        ...t,
        contractId: c.contractId,
        contractLabel: c.label,
        snapshotId,
      }));
      await col(db, "transfers").insertMany(transferDocs);
      console.log(`  → ${transferDocs.length} transfers stored`);
    }

    // Store holders
    if (processed.holders.length > 0) {
      const holderDocs = processed.holders.map((h) => ({
        ...h,
        contractId: c.contractId,
        contractLabel: c.label,
        snapshotId,
      }));
      await col(db, "holders").insertMany(holderDocs);
      console.log(`  → ${holderDocs.length} holders stored`);
    }

    // Compute per-contract analytics
    const minterSet = new Set(processed.mints.map((m) => m.to.toLowerCase()));
    const sellPres = computeSellPressure(processed.transfers.length, processed.mints.length);
    const singleUse = computeSingleUseRate(processed.mints, processed.transfers);
    const holderGrowth = buildHolderGrowth(processed.mints, processed.transfers);
    const heatmap = buildMintTimingHeatmap(processed.mints);
    const velocity = buildMintVelocity(processed.mints);
    const dailyActivity = buildDailyActivity(processed.mints, processed.transfers);

    contractResults.push({
      label: c.label,
      contractId: c.contractId,
      contractInfo: info,
      stats: {
        totalMints: processed.mints.length,
        totalTransfers: processed.transfers.length,
        uniqueHolders: processed.holders.length,
        totalSupply: processed.mints.length,
      },
      minterAddresses: [...minterSet],
      minterSet,
      holders: processed.holders,
      analytics: {
        sellPressure: sellPres,
        singleUseWalletRate: singleUse,
        holderGrowth,
        mintTimingHeatmap: heatmap,
        mintVelocity: velocity,
        dailyActivity,
      },
    });
  }

  // ── Cross-race analytics ──
  console.log("\n━━━ Cross-Race Analytics ━━━");

  const minterSets = contractResults.map((r) => r.minterSet);
  const returnRates = computeReturnRates(minterSets);
  const multiRaceHolders = computeMultiRaceHolders(
    contractResults.map((r) => r.holders),
    contractResults.map((r) => r.label)
  );
  const churnFunnel = buildChurnFunnel(minterSets);

  // Wallets
  let walletsCreated = 0;
  if (accountId) {
    console.log(`\nFetching wallet creations for ${accountId}...`);
    const creations = await fetchAccountCreations(accountId);
    walletsCreated = creations.length;
    console.log(`  ${walletsCreated} wallets created`);

    // Store wallet records
    if (creations.length > 0) {
      const walletDocs = creations.map((w) => ({
        ...w,
        creatorAccountId: accountId,
        snapshotId,
      }));
      await col(db, "wallets").insertMany(walletDocs);
    }
  }

  // Time-to-mint (needs account creation timestamps)
  const allMinterAddrs = new Set();
  for (const r of contractResults) {
    for (const a of r.minterAddresses) allMinterAddrs.add(a);
  }

  let accountCreationMap = {};
  if (allMinterAddrs.size > 0) {
    console.log(`\nFetching account creation timestamps for ${allMinterAddrs.size} minters...`);
    accountCreationMap = await fetchAccountCreationTimestamps([...allMinterAddrs]);
  }

  const timeToMintByContract = contractResults.map((r) => {
    // Reconstruct mints from stored data
    const mints = [];
    // We need the original mints — use the ones in memory
    // (they're in contractResults via the minterAddresses, but we need
    //  the full mint events which were already stored. Since we have them
    //  in memory from the fetch, let's compute from there.)
    return r; // placeholder, we compute below
  });

  // Actually compute TTM per contract
  // We need the original mint arrays — let's re-fetch from the DB
  const ttmByContract = [];
  for (const r of contractResults) {
    const mintDocs = await col(db, "mints").find({
      contractId: r.contractId,
      snapshotId,
    }).toArray();

    const entries = computeTimeToMint(mintDocs, accountCreationMap);
    const summary = summariseTimeToMint(entries);
    ttmByContract.push({
      label: r.label,
      contractId: r.contractId,
      summary,
      count: entries.length,
    });
  }

  // Aggregate totals
  const allHolderAddrs = new Set();
  let totalMints = 0;
  let totalTransfers = 0;
  for (const r of contractResults) {
    totalMints += r.stats.totalMints;
    totalTransfers += r.stats.totalTransfers;
    for (const h of r.holders) allHolderAddrs.add(h.address);
  }

  // ── Build & store snapshot document ──
  const snapshot = {
    createdAt: snapshotId,
    accountId,
    walletsCreated,
    totals: {
      totalMints,
      totalTransfers,
      uniqueHolders: allHolderAddrs.size,
      totalSupply: totalMints,
    },
    contracts: contractResults.map((r) => ({
      label: r.label,
      contractId: r.contractId,
      stats: r.stats,
      analytics: r.analytics,
    })),
    crossRace: {
      returnRates,
      multiRaceHolders,
      churnFunnel,
      timeToMintByContract: ttmByContract,
    },
  };

  await col(db, "snapshots").insertOne(snapshot);
  console.log(`\n✅ Snapshot stored: ${snapshotId.toISOString()}`);
  console.log(`   Mints: ${totalMints}  Transfers: ${totalTransfers}  Holders: ${allHolderAddrs.size}  Wallets: ${walletsCreated}`);
}

async function runLoop() {
  const intervalMin = parseInt(process.env.SYNC_INTERVAL_MINUTES || "0", 10);

  // Always run an initial sync immediately
  try {
    await sync();
  } catch (err) {
    console.error("Sync failed:", err.message);
  }

  // If no interval configured, exit after the first run (one-shot mode)
  if (intervalMin <= 0) {
    await close();
    return;
  }

  const intervalMs = intervalMin * 60 * 1000;
  console.log(`\n⏱  Next sync in ${intervalMin} minute(s)...`);

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    console.log(`\n🔄 Starting scheduled sync (interval: ${intervalMin}min)...`);
    try {
      await sync();
    } catch (err) {
      console.error("Sync failed:", err.message);
    }
    console.log(`\n⏱  Next sync in ${intervalMin} minute(s)...`);
  }
}

runLoop().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
