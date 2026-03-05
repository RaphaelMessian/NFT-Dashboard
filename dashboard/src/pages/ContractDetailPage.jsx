import React, { useEffect } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatDuration } from "../api/analytics";
import ActivityChart from "../components/ActivityChart";
import MintChart from "../components/MintChart";
import MintVelocityChart from "../components/MintVelocityChart";
import HoldersTable from "../components/HoldersTable";
import ActivityTable from "../components/ActivityTable";
import MintTimingHeatmap from "../components/MintTimingHeatmap";
import HolderGrowthChart from "../components/HolderGrowthChart";

/**
 * Detail page for a single NFT contract.
 * Shows per-contract mint/transfer/holder stats, charts, and tables.
 */
export default function ContractDetailPage({ contract, accountId, onBack }) {
  const {
    loading,
    error,
    lastRefresh,
    stats,
    mints,
    transfers,
    holders,
    dailyActivity,
    cumulativeMints,
    holderDistribution,
    contractInfo,
    timeToMint,
    mintVelocity,
    sellPressure,
    mintTimingHeatmap,
    singleUseWalletRate,
    holderGrowth,
    refresh,
  } = useDashboardData(contract.contractId, accountId);

  // Auto-fetch on mount
  useEffect(() => {
    refresh();
  }, [contract.contractId]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [contract.contractId, refresh]);

  // Per-contract stats without walletsCreated (that's on the overview)
  const contractStats = {
    totalMints: stats.totalMints,
    totalTransfers: stats.totalTransfers,
    uniqueHolders: stats.uniqueHolders,
  };

  return (
    <div className="space-y-6">
      {/* Header bar with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ← Overview
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">{contract.label}</h2>
            <p className="text-xs text-gray-500 font-mono">
              {contractInfo?.contract_id || contract.contractId}
              {contractInfo?.evm_address && (
                <span className="ml-2 text-gray-600">
                  ({contractInfo.evm_address})
                </span>
              )}
            </p>
          </div>
        </div>
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

      {/* Stats — 3 cards (no wallets) */}
      <ContractStatsCards stats={contractStats} />

      {/* Time to Mint */}
      {timeToMint.summary.count > 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span>⏱️</span> Time to Mint
            <span className="text-xs text-gray-500 font-normal">
              (account creation → first mint)
            </span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Average</p>
              <p className="text-2xl font-bold text-teal-400">{formatDuration(timeToMint.summary.avg)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Median</p>
              <p className="text-2xl font-bold text-teal-400">{formatDuration(timeToMint.summary.median)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Fastest</p>
              <p className="text-2xl font-bold text-green-400">{formatDuration(timeToMint.summary.min)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Slowest</p>
              <p className="text-2xl font-bold text-red-400">{formatDuration(timeToMint.summary.max)}</p>
            </div>
          </div>
          {/* Per-minter breakdown */}
          {timeToMint.entries.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-300 text-xs">
                Show {timeToMint.entries.length} minter{timeToMint.entries.length !== 1 ? "s" : ""} breakdown
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-1.5 pr-2">Minter</th>
                      <th className="text-right py-1.5 pr-2">Created</th>
                      <th className="text-right py-1.5 pr-2">First Mint</th>
                      <th className="text-right py-1.5">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeToMint.entries.map((e) => (
                      <tr key={e.address} className="border-b border-gray-800/50">
                        <td className="py-1.5 pr-2 font-mono text-gray-400">
                          {e.address.slice(0, 6)}…{e.address.slice(-4)}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-gray-500">
                          {e.createdAt.toLocaleDateString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-gray-500">
                          {e.firstMintAt.toLocaleDateString()}
                        </td>
                        <td className="py-1.5 text-right text-teal-400 font-medium">
                          {formatDuration(e.deltaSec)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityChart data={dailyActivity} />
        <MintChart data={cumulativeMints} />
      </div>

      {/* Mint Velocity */}
      <MintVelocityChart data={mintVelocity} />

      {/* Mint Timing Heatmap */}
      <MintTimingHeatmap data={mintTimingHeatmap} />

      {/* Quick Metrics Row: Sell Pressure, Single-Use Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sell Pressure */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <span>📉</span> Sell Pressure
          </h4>
          <p className={`text-3xl font-bold ${sellPressure.color}`}>
            {sellPressure.pressure.toFixed(2)}
          </p>
          <p className={`text-sm mt-1 ${sellPressure.color}`}>{sellPressure.label}</p>
          <p className="text-xs text-gray-600 mt-1">transfers / mints ratio</p>
        </div>

        {/* Single-Use Wallet Rate */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <span>👤</span> Single-Use Wallets
          </h4>
          <p className={`text-3xl font-bold ${singleUseWalletRate.rate > 0.5 ? "text-amber-400" : "text-green-400"}`}>
            {(singleUseWalletRate.rate * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {singleUseWalletRate.singleUseCount} / {singleUseWalletRate.totalMinters} minters
          </p>
          <p className="text-xs text-gray-600 mt-0.5">minted once, never transferred</p>
        </div>
      </div>

      {/* Holder Growth Over Time */}
      <HolderGrowthChart data={holderGrowth} />

      {/* Holders */}
      <HoldersTable holders={holders} />

      {/* Activity Table */}
      <ActivityTable mints={mints} transfers={transfers} />
    </div>
  );
}

const CONTRACT_CARDS = [
  {
    key: "totalMints",
    label: "Total Minted",
    icon: "🎨",
    color: "from-green-500/20 to-green-600/10 border-green-500/30",
    textColor: "text-green-400",
  },
  {
    key: "totalTransfers",
    label: "Total Transfers",
    icon: "🔄",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    textColor: "text-blue-400",
  },
  {
    key: "uniqueHolders",
    label: "Unique Holders",
    icon: "👛",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    textColor: "text-purple-400",
  },
];

function ContractStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {CONTRACT_CARDS.map((card) => (
        <div
          key={card.key}
          className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-5`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-medium">{card.label}</p>
              <p className={`text-3xl font-bold mt-1 ${card.textColor}`}>
                {stats[card.key]?.toLocaleString() ?? 0}
              </p>
            </div>
            <span className="text-3xl opacity-70">{card.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
