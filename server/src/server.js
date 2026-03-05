/**
 * Express API server for NFT Dashboard reports.
 *
 * Serves snapshot data from MongoDB for the D3.js report page.
 *
 * Endpoints:
 *   GET  /api/snapshots           — list all snapshots (id + date)
 *   GET  /api/snapshots/:id       — full snapshot document
 *   GET  /api/snapshots/latest    — latest snapshot
 *   GET  /api/mints?snapshotId=   — mints for a snapshot
 *   GET  /api/transfers?snapshotId= — transfers for a snapshot
 *   GET  /api/holders?snapshotId=   — holders for a snapshot
 *   GET  /api/wallets?snapshotId=   — wallets for a snapshot
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const { connect, col, ensureIndexes } = require("./db");

const PORT = process.env.PORT || 3002;
const app = express();

app.use(cors());
app.use(express.json());

let db;

// ── Snapshots ──

app.get("/api/snapshots", async (_req, res) => {
  try {
    const snapshots = await col(db, "snapshots")
      .find({}, { projection: { createdAt: 1, "totals": 1, walletsCreated: 1, accountId: 1 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/snapshots/latest", async (_req, res) => {
  try {
    const snapshot = await col(db, "snapshots")
      .findOne({}, { sort: { createdAt: -1 } });
    if (!snapshot) return res.status(404).json({ error: "No snapshots found" });
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/snapshots/:id", async (req, res) => {
  try {
    const snapshot = await col(db, "snapshots").findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Detail collections (by snapshot) ──

app.get("/api/mints", async (req, res) => {
  try {
    const filter = {};
    if (req.query.snapshotId) filter.snapshotId = new Date(req.query.snapshotId);
    if (req.query.contractId) filter.contractId = req.query.contractId;
    const mints = await col(db, "mints").find(filter).sort({ timestamp: 1 }).toArray();
    res.json(mints);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/transfers", async (req, res) => {
  try {
    const filter = {};
    if (req.query.snapshotId) filter.snapshotId = new Date(req.query.snapshotId);
    if (req.query.contractId) filter.contractId = req.query.contractId;
    const transfers = await col(db, "transfers").find(filter).sort({ timestamp: 1 }).toArray();
    res.json(transfers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/holders", async (req, res) => {
  try {
    const filter = {};
    if (req.query.snapshotId) filter.snapshotId = new Date(req.query.snapshotId);
    if (req.query.contractId) filter.contractId = req.query.contractId;
    const holders = await col(db, "holders").find(filter).sort({ tokenCount: -1 }).toArray();
    res.json(holders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/wallets", async (req, res) => {
  try {
    const filter = {};
    if (req.query.snapshotId) filter.snapshotId = new Date(req.query.snapshotId);
    const wallets = await col(db, "wallets").find(filter).sort({ timestamp: 1 }).toArray();
    res.json(wallets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ──

async function start() {
  db = await connect();
  await ensureIndexes(db);
  app.listen(PORT, () => {
    console.log(`\n🚀 NFT Dashboard API running on http://localhost:${PORT}`);
    console.log(`   GET /api/snapshots        — list snapshots`);
    console.log(`   GET /api/snapshots/latest  — latest snapshot`);
    console.log(`   GET /api/snapshots/:id     — snapshot by ID`);
    console.log(`   GET /api/mints             — mint events`);
    console.log(`   GET /api/transfers          — transfer events`);
    console.log(`   GET /api/holders            — holder balances`);
    console.log(`   GET /api/wallets            — wallet creations\n`);
  });
}

start().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
