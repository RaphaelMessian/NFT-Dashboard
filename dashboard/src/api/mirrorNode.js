/**
 * Hedera Mirror Node API client for NFT dashboard.
 *
 * Fetches ERC721 Transfer events, decodes mint vs transfer,
 * computes holder balances, and tracks wallet creation.
 */

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com";

// ERC-721 Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const ZERO_ADDRESS_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Fetch all Transfer event logs for the contract from the mirror node.
 * The mirror node requires a timestamp range for topic filtering, so we
 * fetch all logs and filter client-side by topic[0].
 * Returns raw log entries. Handles pagination.
 */
export async function fetchTransferLogs(contractId) {
  const logs = [];
  let url =
    `${MIRROR_BASE}/api/v1/contracts/${contractId}/results/logs` +
    `?order=asc&limit=100`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mirror node error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    // Filter for Transfer events client-side
    const transferLogs = (data.logs || []).filter(
      (log) => log.topics && log.topics[0] === TRANSFER_EVENT_TOPIC
    );
    logs.push(...transferLogs);

    // Pagination
    if (data.links?.next) {
      url = `${MIRROR_BASE}${data.links.next}`;
    } else {
      url = null;
    }
  }

  return logs;
}

/**
 * Decode a Transfer event log into a structured object.
 * Mirror node returns topics as an array: log.topics[0..3]
 */
function decodeTransferLog(log) {
  const topics = log.topics || [];
  // topics[1] = from (padded to 32 bytes), topics[2] = to, topics[3] = tokenId
  const from = "0x" + (topics[1] || "").slice(26);
  const to = "0x" + (topics[2] || "").slice(26);
  const tokenId = parseInt(topics[3], 16);
  const isMint = topics[1] === ZERO_ADDRESS_TOPIC;
  const timestamp = log.timestamp
    ? new Date(parseFloat(log.timestamp) * 1000)
    : null;

  return {
    from: from.toLowerCase(),
    to: to.toLowerCase(),
    tokenId,
    isMint,
    timestamp,
    blockNumber: log.block_number,
    transactionHash: log.transaction_hash,
  };
}

/**
 * Process all Transfer logs into mints, transfers, and holder balances.
 */
export function processTransferLogs(rawLogs) {
  const mints = [];
  const transfers = [];
  const holderBalances = {}; // address -> Set of tokenIds

  for (const log of rawLogs) {
    const decoded = decodeTransferLog(log);

    if (decoded.isMint) {
      mints.push(decoded);
    } else {
      transfers.push(decoded);
    }

    // Update holder balances
    if (decoded.from !== "0x0000000000000000000000000000000000000000") {
      if (holderBalances[decoded.from]) {
        holderBalances[decoded.from].delete(decoded.tokenId);
        if (holderBalances[decoded.from].size === 0) {
          delete holderBalances[decoded.from];
        }
      }
    }
    if (decoded.to !== "0x0000000000000000000000000000000000000000") {
      if (!holderBalances[decoded.to]) {
        holderBalances[decoded.to] = new Set();
      }
      holderBalances[decoded.to].add(decoded.tokenId);
    }
  }

  // Convert Sets to arrays for easier consumption
  const holders = Object.entries(holderBalances).map(([address, tokenIds]) => ({
    address,
    tokenCount: tokenIds.size,
    tokenIds: [...tokenIds],
  }));

  // Sort holders by token count descending
  holders.sort((a, b) => b.tokenCount - a.tokenCount);

  return { mints, transfers, holders };
}

/**
 * Fetch account creation transactions for a given account ID (the creator).
 * Tracks wallets created by the funder/treasury account.
 */
export async function fetchAccountCreations(accountId) {
  const creations = [];
  // Don't filter by transactiontype server-side: lazy-creation (HIP-32) generates
  // CRYPTOCREATEACCOUNT as a child transaction (nonce=1) whose transfers list does
  // not contain the payer, so the mirror node ignores the account.id filter for them.
  // Instead, fetch all transactions from the account and filter client-side.
  let url =
    `${MIRROR_BASE}/api/v1/transactions` +
    `?account.id=${accountId}&order=asc&limit=100`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Mirror node error: ${res.status}`);
    }
    const data = await res.json();

    for (const tx of data.transactions || []) {
      if (tx.name === "CRYPTOCREATEACCOUNT" && tx.result === "SUCCESS") {
        creations.push({
          transactionId: tx.transaction_id,
          timestamp: tx.consensus_timestamp
            ? new Date(parseFloat(tx.consensus_timestamp) * 1000)
            : null,
          transfers: tx.transfers,
          result: tx.result,
          entityId: tx.entity_id,
        });
      }
    }

    if (data.links?.next) {
      url = `${MIRROR_BASE}${data.links.next}`;
    } else {
      url = null;
    }
  }

  return creations;
}

/**
 * Also look for auto-created accounts via HBAR transfers (lazy creation).
 * On Hedera, sending HBAR to a new alias auto-creates the account.
 * We track CryptoTransfer transactions from the funder that also transfer to new accounts.
 */
export async function fetchCryptoTransfers(accountId) {
  const results = [];
  let url =
    `${MIRROR_BASE}/api/v1/transactions` +
    `?account.id=${accountId}&transactiontype=CRYPTOTRANSFER&order=desc&limit=50`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  for (const tx of data.transactions || []) {
    results.push({
      transactionId: tx.transaction_id,
      timestamp: tx.consensus_timestamp
        ? new Date(parseFloat(tx.consensus_timestamp) * 1000)
        : null,
      result: tx.result,
    });
  }

  return results;
}

/**
 * Fetch account info for an EVM address or Hedera account ID.
 * Returns { created_timestamp, account, evm_address, ... } or null.
 */
export async function fetchAccountInfo(addressOrId) {
  const res = await fetch(`${MIRROR_BASE}/api/v1/accounts/${addressOrId}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Batch-fetch account creation timestamps for a list of EVM addresses.
 * Returns Map<address, Date> with lowercased addresses as keys.
 * Fetches in parallel batches of 10 to avoid overwhelming the mirror node.
 */
export async function fetchAccountCreationTimestamps(addresses) {
  const map = new Map();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];

  const BATCH_SIZE = 10;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (addr) => {
        try {
          const info = await fetchAccountInfo(addr);
          if (info?.created_timestamp) {
            return [addr, new Date(parseFloat(info.created_timestamp) * 1000)];
          }
        } catch {
          // skip
        }
        return [addr, null];
      })
    );
    for (const [addr, ts] of results) {
      if (ts) map.set(addr, ts);
    }
  }

  return map;
}

/**
 * Fetch contract info from mirror node (name, token associations, etc.).
 */
export async function fetchContractInfo(contractId) {
  const res = await fetch(`${MIRROR_BASE}/api/v1/contracts/${contractId}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Build daily activity chart data from mints and transfers.
 */
export function buildDailyActivity(mints, transfers) {
  const dayMap = {};

  const addToDay = (date, key) => {
    if (!date) return;
    const day = date.toISOString().split("T")[0];
    if (!dayMap[day]) dayMap[day] = { date: day, mints: 0, transfers: 0 };
    dayMap[day][key]++;
  };

  mints.forEach((m) => addToDay(m.timestamp, "mints"));
  transfers.forEach((t) => addToDay(t.timestamp, "transfers"));

  return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build cumulative mint chart data.
 */
export function buildCumulativeMints(mints) {
  const sorted = [...mints].sort((a, b) => a.timestamp - b.timestamp);
  let cumulative = 0;
  return sorted.map((m) => ({
    date: m.timestamp?.toISOString().split("T")[0],
    time: m.timestamp?.toLocaleString(),
    tokenId: m.tokenId,
    total: ++cumulative,
  }));
}

/**
 * Build holder distribution data for pie/bar chart.
 */
export function buildHolderDistribution(holders) {
  const ranges = [
    { label: "1 NFT", min: 1, max: 1 },
    { label: "2-5 NFTs", min: 2, max: 5 },
    { label: "6-10 NFTs", min: 6, max: 10 },
    { label: "11-25 NFTs", min: 11, max: 25 },
    { label: "26+ NFTs", min: 26, max: Infinity },
  ];

  return ranges
    .map((range) => ({
      name: range.label,
      count: holders.filter(
        (h) => h.tokenCount >= range.min && h.tokenCount <= range.max
      ).length,
    }))
    .filter((r) => r.count > 0);
}
