import React from "react";

export default function ConfigPanel({
  contracts,
  selectedIndex,
  onSelectContract,
  onRefresh,
  loading,
  lastRefresh,
}) {
  const hasMultiple = contracts.length > 1;

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* Contract selector */}
        <div className="flex-1 flex items-center gap-3">
          {hasMultiple ? (
            <div className="flex gap-1.5 flex-wrap">
              {contracts.map((c, idx) => (
                <button
                  key={c.contractId}
                  onClick={() => onSelectContract(idx)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    idx === selectedIndex
                      ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : contracts.length === 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Contract:</span>
              <span className="text-sm font-medium text-white">
                {contracts[0].label}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                ({contracts[0].contractId})
              </span>
            </div>
          ) : (
            <p className="text-sm text-amber-400">
              No contracts configured. Add VITE_NFT_CONTRACTS to your .env file.
            </p>
          )}
        </div>

        {/* Refresh button + status */}
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading || contracts.length === 0}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors whitespace-nowrap flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading...
              </>
            ) : (
              "↻ Refresh"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
