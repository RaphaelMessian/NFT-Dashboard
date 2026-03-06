import React, { useState } from "react";
import { getContracts, getAccountId } from "./config";
import OverviewPage from "./pages/OverviewPage";
import ContractDetailPage from "./pages/ContractDetailPage";
import ReportPage from "./pages/ReportPage";

const contracts = getContracts();
const accountId = getAccountId();

// page: "live" | "report"
export default function App() {
  const [page, setPage] = useState("live");
  // null = overview page, number = index into contracts[]
  const [selectedContract, setSelectedContract] = useState(null);

  const currentContract =
    selectedContract !== null ? contracts[selectedContract] : null;

  const goLive = () => {
    setPage("live");
    setSelectedContract(null);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50 print:static print:border-none print:bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={goLive}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">🚀</span>
            <div className="text-left">
              <h1 className="text-xl font-bold text-white print:text-gray-900">
                NFT Launch Dashboard
              </h1>
              <p className="text-xs text-gray-400">
                Hedera Hashgraph Mainnet
                {page === "live" && currentContract && (
                  <span className="ml-2 text-green-400">
                    • {currentContract.label}
                  </span>
                )}
                {page === "report" && (
                  <span className="ml-2 text-indigo-400">• Report View</span>
                )}
              </p>
            </div>
          </button>

          {/* Nav tabs */}
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={goLive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                page === "live"
                  ? "bg-green-600/20 text-green-400 border border-green-600/40"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
              Live
            </button>
            <button
              onClick={() => setPage("report")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                page === "report"
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/40"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              📊 Report
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {page === "report" ? (
          <ReportPage />
        ) : selectedContract === null ? (
          <OverviewPage
            contracts={contracts}
            accountId={accountId}
            onSelectContract={setSelectedContract}
          />
        ) : (
          <ContractDetailPage
            contract={currentContract}
            accountId={accountId}
            onBack={() => setSelectedContract(null)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-4 print:hidden">
        <p className="text-center text-xs text-gray-600">
          Data sourced from{" "}
          <a
            href="https://mainnet-public.mirrornode.hedera.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300"
          >
            Hedera Mirror Node (Mainnet)
          </a>{" "}
          • {page === "live" ? "Auto-refreshes every 30s" : "Report from MongoDB snapshot"}
        </p>
      </footer>
    </div>
  );
}
