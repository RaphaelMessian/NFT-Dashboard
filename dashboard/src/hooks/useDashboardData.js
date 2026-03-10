import { useState, useCallback, useEffect, useRef } from "react";
import { fetchLatestSnapshot, fetchMints, fetchTransfers, fetchHolders } from "../api/reportApi";

const SP_COLORS = {
  "Very Low": "text-green-400",
  "Low": "text-green-300",
  "Moderate": "text-yellow-400",
  "High": "text-orange-400",
  "Very High": "text-red-400",
};

/**
 * Custom hook that manages dashboard data for a single contract.
 * @param {string} contractId - Hedera contract ID (e.g. "0.0.12345")
 * @param {string} accountId - Creator account ID for wallet tracking
 */
export function useDashboardData(contractId, accountId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Data state
  const [stats, setStats] = useState({
    totalMints: 0,
    totalTransfers: 0,
    uniqueHolders: 0,
  });
  const [mints, setMints] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [holders, setHolders] = useState([]);
  const [dailyActivity, setDailyActivity] = useState([]);
  const [cumulativeMints, setCumulativeMints] = useState([]);
  const [holderDistribution, setHolderDistribution] = useState([]);
  const [contractInfo, setContractInfo] = useState(null);
  const [mintVelocity, setMintVelocity] = useState([]);
  const [sellPressure, setSellPressure] = useState({ pressure: 0, label: "No data", color: "text-gray-500" });
  const [mintTimingHeatmap, setMintTimingHeatmap] = useState(null);
  const [singleUseWalletRate, setSingleUseWalletRate] = useState({ singleUseCount: 0, totalMinters: 0, rate: 0 });
  const [holderGrowth, setHolderGrowth] = useState([]);

  // Track current contractId to avoid stale updates
  const currentContractRef = useRef(contractId);
  currentContractRef.current = contractId;

  const refresh = useCallback(async () => {
    if (!contractId) {
      setError("No contract ID configured");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snapshot = await fetchLatestSnapshot();

      if (currentContractRef.current !== contractId) return;

      const contractData = (snapshot?.contracts ?? []).find((c) => c.contractId === contractId);
      const analytics = contractData?.analytics ?? {};
      const contractStats = contractData?.stats ?? {};
      setStats({
        totalMints: contractStats.totalMints ?? 0,
        totalTransfers: contractStats.totalTransfers ?? 0,
        uniqueHolders: contractStats.uniqueHolders ?? 0,
      });
      setDailyActivity(analytics.dailyActivity ?? []);
      setCumulativeMints(analytics.cumulativeMints ?? []);
      setHolderDistribution(analytics.holderDistribution ?? []);
      setContractInfo(contractData?.contractInfo ?? null);
      setMintVelocity(analytics.mintVelocity ?? []);
      const sp = analytics.sellPressure ?? {};
      setSellPressure({ pressure: 0, label: "No data", ...sp, color: SP_COLORS[sp.label] ?? "text-gray-500" });
      setMintTimingHeatmap(analytics.mintTimingHeatmap ?? null);
      setSingleUseWalletRate(analytics.singleUseWalletRate ?? { singleUseCount: 0, totalMinters: 0, rate: 0 });
      setHolderGrowth(analytics.holderGrowth ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      if (currentContractRef.current === contractId) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  // Reset state when contract changes
  useEffect(() => {
    setMints([]);
    setTransfers([]);
    setHolders([]);
    setDailyActivity([]);
    setCumulativeMints([]);
    setHolderDistribution([]);
    setContractInfo(null);
    setMintVelocity([]);
    setSellPressure({ pressure: 0, label: "No data", color: "text-gray-500" });
    setMintTimingHeatmap(null);
    setSingleUseWalletRate({ singleUseCount: 0, totalMinters: 0, rate: 0 });
    setHolderGrowth([]);
    setStats({ totalMints: 0, totalTransfers: 0, uniqueHolders: 0 });
    setLastRefresh(null);
    setError(null);
  }, [contractId]);

  // Load raw table data (mints, transfers, holders) once per contractId.
  // Not called on every refresh — these are historical records that change rarely.
  useEffect(() => {
    if (!contractId) return;
    let cancelled = false;
    const toDate = (v) => (v ? new Date(v) : null);
    (async () => {
      try {
        const [rawMints, rawTransfers, rawHolders] = await Promise.all([
          fetchMints(null, contractId),
          fetchTransfers(null, contractId),
          fetchHolders(null, contractId),
        ]);
        if (cancelled) return;
        setMints(rawMints.map((m) => ({ ...m, timestamp: toDate(m.timestamp) })));
        setTransfers(rawTransfers.map((t) => ({ ...t, timestamp: toDate(t.timestamp) })));
        setHolders(rawHolders);
      } catch (err) {
        console.error("Failed to load table data:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [contractId]);

  return {
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
    mintVelocity,
    sellPressure,
    mintTimingHeatmap,
    singleUseWalletRate,
    holderGrowth,
    refresh,
  };
}
