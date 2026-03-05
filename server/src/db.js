/**
 * MongoDB connection singleton.
 *
 * Uses MONGO_URI from env (default: localhost:27017).
 * Database: nft_dashboard
 */
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "nft_dashboard";

let _client = null;

async function connect() {
  if (!_client) {
    _client = new MongoClient(uri);
    await _client.connect();
    console.log(`[MongoDB] Connected to ${uri}`);
  }
  return _client.db(DB_NAME);
}

async function close() {
  if (_client) {
    await _client.close();
    _client = null;
    console.log("[MongoDB] Connection closed");
  }
}

/** Helper: get a typed collection */
function col(db, name) {
  return db.collection(name);
}

/**
 * Ensure indexes exist for efficient querying.
 */
async function ensureIndexes(db) {
  // Snapshots — query by date
  await col(db, "snapshots").createIndex({ createdAt: -1 });
  await col(db, "snapshots").createIndex({ "contracts.contractId": 1 });

  // Mints — query by contract + timestamp
  await col(db, "mints").createIndex({ contractId: 1, timestamp: 1 });
  await col(db, "mints").createIndex({ to: 1 });
  await col(db, "mints").createIndex({ snapshotId: 1 });

  // Transfers — query by contract + timestamp
  await col(db, "transfers").createIndex({ contractId: 1, timestamp: 1 });
  await col(db, "transfers").createIndex({ from: 1 });
  await col(db, "transfers").createIndex({ to: 1 });
  await col(db, "transfers").createIndex({ snapshotId: 1 });

  // Holders — query by contract + snapshot
  await col(db, "holders").createIndex({ contractId: 1, snapshotId: 1 });

  // Wallets — query by creator + timestamp
  await col(db, "wallets").createIndex({ creatorAccountId: 1, timestamp: 1 });
  await col(db, "wallets").createIndex({ snapshotId: 1 });

  console.log("[MongoDB] Indexes ensured");
}

module.exports = { connect, close, col, ensureIndexes, DB_NAME };
