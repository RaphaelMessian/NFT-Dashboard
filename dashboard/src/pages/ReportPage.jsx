import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchLatestSnapshot } from "../api/reportApi";

// D3 components
import D3MintHeatmap from "../components/d3/D3MintHeatmap";
import D3HolderGrowth from "../components/d3/D3HolderGrowth";
import D3ChurnFunnel from "../components/d3/D3ChurnFunnel";
import D3RadialGauge from "../components/d3/D3RadialGauge";
import D3MintVelocity from "../components/d3/D3MintVelocity";

/* ───── helpers ───── */
const fmtDate = (d) =>
  new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const Card = ({ title, children, className = "" }) => (
  <div
    className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}
  >
    {title && (
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, sub }) => (
  <div className="text-center">
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
  </div>
);

/* ────────────────────────────────────────────────── */
export default function ReportPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef();

  // Always load the latest snapshot
  useEffect(() => {
    fetchLatestSnapshot()
      .then(setSnapshot)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  /* ── Print / Export ── */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* ── Loading / Error states ── */
  if (loading && !snapshot) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
        <span className="ml-3 text-gray-400">Loading report data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 max-w-xl mx-auto mt-10">
        <p className="font-semibold mb-1">⚠ Report Error</p>
        <p className="text-sm">{error}</p>
        <p className="text-xs text-red-400 mt-2">
          Make sure the API server is running on port 3002 and MongoDB has
          snapshot data.
        </p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="text-gray-400 text-center py-20">
        <p className="text-lg">No snapshots available.</p>
        <p className="text-sm mt-1">
          Run <code className="text-indigo-400">node src/sync.js</code> in{" "}
          <code className="text-indigo-400">server/</code> to create one.
        </p>
      </div>
    );
  }

  const { totals, contracts, crossRace, walletsCreated, createdAt } = snapshot;

  return (
    <div ref={reportRef}>
      {/* Controls bar (hidden on print) */}
      <div className="flex items-center justify-end mb-6 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          🖨️ Print / Export PDF
        </button>
      </div>

      {/* Report Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">
          NFT Launch — Snapshot Report
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Generated {fmtDate(createdAt)} • {contracts.length} contract
          {contracts.length !== 1 ? "s" : ""} monitored
        </p>
      </div>

      {/* ═══════════ GLOBAL STATS ═══════════ */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Stat label="Total Mints" value={totals.totalMints} />
          <Stat label="Total Transfers" value={totals.totalTransfers} />
          <Stat label="Unique Holders" value={totals.uniqueHolders} />
          <Stat label="Total Supply" value={totals.totalSupply} />
          <Stat label="Wallets Created" value={walletsCreated} />
        </div>
      </Card>

      {/* ═══════════ PER-CONTRACT SECTIONS ═══════════ */}
      {contracts.map((c, ci) => (
        <section key={ci} className="mb-10">
          <h3 className="text-lg font-bold text-indigo-400 mb-4 border-b border-gray-800 pb-2">
            📦 {c.label}{" "}
            <span className="text-xs text-gray-500 font-mono ml-2">
              {c.contractId}
            </span>
          </h3>

          {/* Contract stats row */}
          <Card className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Mints" value={c.stats.totalMints} />
              <Stat label="Transfers" value={c.stats.totalTransfers} />
              <Stat label="Holders" value={c.stats.uniqueHolders} />
              <Stat label="Supply" value={c.stats.totalSupply} />
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Mint velocity */}
            <Card title="Mint Velocity (daily)">
              {c.analytics.mintVelocity?.length > 0 ? (
                <D3MintVelocity
                  data={c.analytics.mintVelocity.map((v) => ({
                    date: v.date || v.hour || v.day,
                    count: v.count ?? v.mints ?? 0,
                  }))}
                  width={500}
                  height={200}
                />
              ) : (
                <p className="text-gray-600 text-sm">Not enough data</p>
              )}
            </Card>

            {/* Mint timing heatmap */}
            <Card title="Mint Timing Heatmap (hour × day)">
              {c.analytics.mintTimingHeatmap?.dayHourGrid ? (
                <D3MintHeatmap data={c.analytics.mintTimingHeatmap} width={500} height={200} />
              ) : (
                <p className="text-gray-600 text-sm">No data</p>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Holder Growth */}
            <Card title="Holder Growth Over Time">
              {c.analytics.holderGrowth?.length > 0 ? (
                <D3HolderGrowth data={c.analytics.holderGrowth} width={500} height={220} />
              ) : (
                <p className="text-gray-600 text-sm">No data</p>
              )}
            </Card>

            {/* Sell Pressure */}
            <Card title="Sell Pressure">
              <div className="flex items-center justify-center">
                <D3RadialGauge
                  value={c.analytics.sellPressure?.pressure ?? 0}
                  label="Sell Pressure"
                  classification={c.analytics.sellPressure?.label ?? ""}
                  color={c.analytics.sellPressure?.color ?? "#6366f1"}
                  width={180}
                  height={180}
                />
              </div>
            </Card>
          </div>

          {/* Single-Use Wallet Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 mb-4">
            <Card title="Single-Use Wallet Rate">
              <p className="text-xl font-bold text-orange-400">
                {c.analytics.singleUseWalletRate != null
                  ? ((typeof c.analytics.singleUseWalletRate === "number"
                      ? c.analytics.singleUseWalletRate
                      : c.analytics.singleUseWalletRate.rate ?? 0
                    ) * 100).toFixed(1) + "%"
                  : "N/A"}
              </p>
              <p className="text-xs text-gray-500 mt-1">minted once, never transferred</p>
            </Card>
          </div>
        </section>
      ))}

      {/* ═══════════ CROSS-RACE ANALYTICS ═══════════ */}
      {crossRace && (
        <section className="mb-10">
          <h3 className="text-lg font-bold text-emerald-400 mb-4 border-b border-gray-800 pb-2">
            🌐 Cross-Race Analytics
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Churn Funnel */}
            <Card title="Churn Funnel (Multi-Contract Retention)">
              {crossRace.churnFunnel?.length > 0 ? (
                <D3ChurnFunnel
                  data={crossRace.churnFunnel.map((f) => ({
                    label: `Race ${f.race}`,
                    count: f.retained,
                  }))}
                  width={450}
                  height={180}
                />
              ) : (
                <p className="text-gray-600 text-sm">
                  Need multiple contracts for funnel
                </p>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Return Rates */}
            <Card title="Cross-Contract Minter Retention">
              {crossRace.returnRates ? (
                <div className="space-y-2">
                  <Stat
                    label="Returned to mint again"
                    value={crossRace.returnRates.returnedCount ?? 0}
                  />
                  <p className="text-xs text-gray-500 text-center">
                    {crossRace.returnRates.rate != null
                      ? `${(crossRace.returnRates.rate * 100).toFixed(1)}% retention (${crossRace.returnRates.prevCount} → ${crossRace.returnRates.returnedCount})`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">N/A</p>
              )}
            </Card>

            {/* Multi-Race Holders */}
            <Card title="Multi-Race Holders">
              {Array.isArray(crossRace.multiRaceHolders) ? (
                <div className="space-y-2">
                  <Stat
                    label="Hold ≥2 collections"
                    value={crossRace.multiRaceHolders.length}
                  />
                  {crossRace.multiRaceHolders.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {crossRace.multiRaceHolders.slice(0, 5).map((h, i) => (
                        <p key={i} className="text-xs text-gray-400 truncate">
                          <span className="text-gray-300 font-mono">
                            {h.address.slice(0, 10)}…
                          </span>{" "}
                          — {h.races?.join(", ")}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">N/A</p>
              )}
            </Card>
          </div>

          {/* Time to mint by contract */}
          {crossRace.timeToMintByContract && (
            <Card title="Time-to-Mint by Contract" className="mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Array.isArray(crossRace.timeToMintByContract)
                  ? crossRace.timeToMintByContract
                  : Object.entries(crossRace.timeToMintByContract).map(
                      ([k, v]) => ({ label: k, summary: v })
                    )
                ).map((item, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/50 rounded-lg p-3 text-center"
                  >
                    <p className="text-sm font-medium text-gray-300">
                      {item.label}
                    </p>
                    <p className="text-lg font-bold text-white mt-1">
                      {item.summary?.median != null
                        ? fmtDuration(item.summary.median)
                        : "N/A"}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      median TTM
                      {item.summary?.count
                        ? ` (${item.summary.count} minters)`
                        : ""}
                    </p>
                    {item.summary?.avg != null && (
                      <p className="text-[10px] text-gray-600">
                        avg: {fmtDuration(item.summary.avg)} • min:{" "}
                        {fmtDuration(item.summary.min)} • max:{" "}
                        {fmtDuration(item.summary.max)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      {/* Report footer */}
      <div className="text-center text-xs text-gray-600 mt-8 mb-4 print:mt-4">
        <p>
          Report generated from MongoDB snapshot •{" "}
          {fmtDate(createdAt)}
        </p>
        <p>Data source: Hedera Mirror Node (Testnet)</p>
      </div>
    </div>
  );
}

/* Helper to format seconds into human-readable duration */
function fmtDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}
