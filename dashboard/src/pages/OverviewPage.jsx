import React, { useEffect } from "react";
import { useOverviewData } from "../hooks/useOverviewData";
import { formatDuration } from "../api/analytics";

/**
 * Main overview page — shows aggregated stats across ALL NFT contracts
 * plus the total wallets created from the creator account.
 * Includes cross-race analytics: return rate, cumulative unique minters,
 * lapsed wallet reactivation, and per-contract time-to-mint.
 */
export default function OverviewPage({ contracts, accountId, onSelectContract }) {
  const {
    loading,
    error,
    lastRefresh,
    totals,
    walletsCreated,
    contractSummaries,
    returnRates,
    cumulativeUniqueMinters,
    lapsedReactivation,
    timeToMintByContract,
    multiRaceHolders,
    churnFunnel,
    sellPressureByContract,
    singleUseRateByContract,
    refresh,
  } = useOverviewData(contracts, accountId);

  // Auto-fetch on mount
  useEffect(() => {
    if (contracts.length > 0) refresh();
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    if (contracts.length === 0) return;
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh, contracts]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Overview</h2>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </>
            ) : (
              "↻ Refresh"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Wallets Created"
          value={walletsCreated}
          icon="➕"
          color="from-amber-500/20 to-amber-600/10 border-amber-500/30"
          textColor="text-amber-400"
        />
        <StatCard
          label="Total Minted"
          value={totals.totalMints}
          icon="🎨"
          color="from-green-500/20 to-green-600/10 border-green-500/30"
          textColor="text-green-400"
          subtitle="across all contracts"
        />
        <StatCard
          label="Total Transfers"
          value={totals.totalTransfers}
          icon="🔄"
          color="from-blue-500/20 to-blue-600/10 border-blue-500/30"
          textColor="text-blue-400"
          subtitle="across all contracts"
        />
        <StatCard
          label="Unique Holders"
          value={totals.uniqueHolders}
          icon="👛"
          color="from-purple-500/20 to-purple-600/10 border-purple-500/30"
          textColor="text-purple-400"
          subtitle="across all contracts"
        />
      </div>

      {/* Per-contract summary cards */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          NFT Contracts ({contractSummaries.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contractSummaries.map((summary, idx) => (
            <button
              key={summary.contractId}
              onClick={() => onSelectContract(idx)}
              className="text-left rounded-xl border border-gray-700/50 bg-gray-900/50 p-5 hover:border-green-500/40 hover:bg-gray-900/80 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-white group-hover:text-green-400 transition-colors">
                    {summary.label}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono">
                    {summary.contractId}
                  </p>
                </div>
                <span className="text-gray-600 group-hover:text-green-400 transition-colors text-lg">
                  →
                </span>
              </div>

              {summary.error ? (
                <p className="text-xs text-red-400">Error: {summary.error}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Minted" value={summary.mints} color="text-green-400" />
                  <MiniStat label="Transfers" value={summary.transfers} color="text-blue-400" />
                  <MiniStat label="Holders" value={summary.holders} color="text-purple-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cross-Race Analytics ── */}
      {contracts.length >= 1 && (
        <div className="space-y-6">
          <h3 className="text-sm font-medium text-gray-400">
            Cross-Race Analytics
          </h3>

          {/* Cumulative Unique Minters */}
          {cumulativeUniqueMinters.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>👥</span> Cumulative Unique Minters
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 pr-4">Race</th>
                      <th className="text-left py-2 pr-4">Contract</th>
                      <th className="text-right py-2 pr-4">Race Minters</th>
                      <th className="text-right py-2 pr-4">New Minters</th>
                      <th className="text-right py-2">Cumulative Unique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumulativeUniqueMinters.map((row) => (
                      <tr key={row.race} className="border-b border-gray-800/50">
                        <td className="py-2 pr-4 text-gray-400">#{row.race}</td>
                        <td className="py-2 pr-4 text-gray-300">
                          {contracts[row.race - 1]?.label ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-300">
                          {contractSummaries[row.race - 1]?.minterSet?.size ?? 0}
                        </td>
                        <td className="py-2 pr-4 text-right text-cyan-400 font-medium">
                          {row.newMinters}
                        </td>
                        <td className="py-2 text-right text-white font-bold">
                          {row.cumulativeUnique}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* User Return Rate */}
          {returnRates.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>🔁</span> User Return Rate
                <span className="text-xs text-gray-500 font-normal">
                  (minters in Race N that also minted in Race N+1)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {returnRates.map((r) => (
                  <div
                    key={`${r.from}-${r.to}`}
                    className="rounded-lg border border-gray-700/40 bg-gray-800/40 p-4"
                  >
                    <p className="text-xs text-gray-500 mb-1">
                      {contracts[r.from - 1]?.label ?? `Race ${r.from}`} →{" "}
                      {contracts[r.to - 1]?.label ?? `Race ${r.to}`}
                    </p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {(r.rate * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.returnedCount} / {r.prevCount} wallets returned
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lapsed Wallet Reactivation */}
          {lapsedReactivation.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>♻️</span> Lapsed Wallet Reactivation
                <span className="text-xs text-gray-500 font-normal">
                  (wallets that skipped a race, then returned)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lapsedReactivation.map((l) => (
                  <div
                    key={l.race}
                    className="rounded-lg border border-gray-700/40 bg-gray-800/40 p-4"
                  >
                    <p className="text-xs text-gray-500 mb-1">
                      Race #{l.race} — {contracts[l.race - 1]?.label ?? ""}
                    </p>
                    <p className="text-2xl font-bold text-amber-400">
                      {l.reactivatedCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      wallet{l.reactivatedCount !== 1 ? "s" : ""} reactivated
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-contract Time to Mint */}
          {timeToMintByContract.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>⏱️</span> Time to Mint
                <span className="text-xs text-gray-500 font-normal">
                  (account creation → first mint)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {timeToMintByContract.map((t) => (
                  <div
                    key={t.contractId}
                    className="rounded-lg border border-gray-700/40 bg-gray-800/40 p-4"
                  >
                    <p className="text-xs text-gray-500 mb-2">{t.label}</p>
                    {t.summary.count === 0 ? (
                      <p className="text-sm text-gray-600">No data yet</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Avg</p>
                          <p className="text-lg font-bold text-teal-400">
                            {formatDuration(t.summary.avg)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Median</p>
                          <p className="text-lg font-bold text-teal-400">
                            {formatDuration(t.summary.median)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Min</p>
                          <p className="text-lg font-bold text-green-400">
                            {formatDuration(t.summary.min)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Max</p>
                          <p className="text-lg font-bold text-red-400">
                            {formatDuration(t.summary.max)}
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-2 text-right">
                      {t.summary.count} minter{t.summary.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Race Holders */}
          {multiRaceHolders.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>💎</span> Multi-Race Holders
                <span className="text-xs text-gray-500 font-normal">
                  ({multiRaceHolders.length} wallet{multiRaceHolders.length !== 1 ? "s" : ""} holding NFTs from 2+ races)
                </span>
              </h4>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-2 pr-2">Wallet</th>
                      <th className="text-right py-2 pr-2">Races</th>
                      <th className="text-left py-2">Contracts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiRaceHolders.map((h) => (
                      <tr key={h.address} className="border-b border-gray-800/50">
                        <td className="py-2 pr-2 font-mono text-gray-400 text-xs">
                          {h.address.slice(0, 6)}…{h.address.slice(-4)}
                        </td>
                        <td className="py-2 pr-2 text-right text-white font-bold">
                          {h.raceCount}
                        </td>
                        <td className="py-2 text-xs text-gray-500">
                          {h.races.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Churn Funnel */}
          {churnFunnel.length > 1 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>🔻</span> Churn Funnel
                <span className="text-xs text-gray-500 font-normal">
                  (Race 1 minters retained through subsequent races)
                </span>
              </h4>
              <div className="space-y-2">
                {churnFunnel.map((step) => (
                  <div key={step.race} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0">
                      {contracts[step.race - 1]?.label ?? `Race ${step.race}`}
                    </span>
                    <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all"
                        style={{
                          width: `${Math.max(step.pct, 2)}%`,
                          background: step.race === 1
                            ? "linear-gradient(90deg, #22c55e, #16a34a)"
                            : step.pct > 50
                            ? "linear-gradient(90deg, #22c55e, #eab308)"
                            : "linear-gradient(90deg, #f59e0b, #ef4444)",
                        }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white">
                        {step.retained} ({step.pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sell Pressure by Contract */}
          {sellPressureByContract.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>📉</span> Sell Pressure Index
                <span className="text-xs text-gray-500 font-normal">
                  (transfers / mints — higher = more flipping)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sellPressureByContract.map((sp) => (
                  <div
                    key={sp.contractId}
                    className="rounded-lg border border-gray-700/40 bg-gray-800/40 p-4"
                  >
                    <p className="text-xs text-gray-500 mb-1">{sp.contractLabel}</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${sp.pressureColor}`}>
                        {sp.pressure.toFixed(2)}
                      </span>
                      <span className={`text-sm ${sp.pressureColor}`}>{sp.pressureLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single-Use Wallet Rate by Contract */}
          {singleUseRateByContract.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>👤</span> Single-Use Wallet Rate
                <span className="text-xs text-gray-500 font-normal">
                  (minted exactly once, never transferred out)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {singleUseRateByContract.map((su) => (
                  <div
                    key={su.contractId}
                    className="rounded-lg border border-gray-700/40 bg-gray-800/40 p-4"
                  >
                    <p className="text-xs text-gray-500 mb-1">{su.label}</p>
                    <p className={`text-2xl font-bold ${su.rate > 0.5 ? "text-amber-400" : "text-green-400"}`}>
                      {(su.rate * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {su.singleUseCount} / {su.totalMinters} minters
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, textColor, subtitle }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${color} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${textColor}`}>
            {value?.toLocaleString() ?? 0}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="text-3xl opacity-70">{icon}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value?.toLocaleString()}</p>
    </div>
  );
}
