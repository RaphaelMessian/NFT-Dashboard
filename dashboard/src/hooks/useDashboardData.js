import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchTransferLogs,
  processTransferLogs,
  fetchContractInfo,
  fetchAccountCreationTimestamps,
  buildDailyActivity,
  buildCumulativeMints,
  buildHolderDistribution,
} from "../api/mirrorNode";
import {
  computeTimeToMint,
  summariseTimeToMint,
  buildMintVelocity,
  computeSellPressure,
  buildMintTimingHeatmap,
  computeSingleUseWalletRate,
  buildHolderGrowth,
} from "../api/analytics";

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
  const [timeToMint, setTimeToMint] = useState({ entries: [], summary: { avg: 0, median: 0, min: 0, max: 0, count: 0 } });
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
      // Fetch contract info and transfer logs in parallel
      const [info, rawLogs] = await Promise.all([
        fetchContractInfo(contractId).catch(() => null),
        fetchTransferLogs(contractId),
      ]);

      // Prevent stale updates if contract was switched while loading
      if (currentContractRef.current !== contractId) return;

      setContractInfo(info);

      // Process transfer events
      const processed = processTransferLogs(rawLogs);
      setMints(processed.mints);
      setTransfers(processed.transfers);
      setHolders(processed.holders);

      // Build chart data
      setDailyActivity(buildDailyActivity(processed.mints, processed.transfers));
      setCumulativeMints(buildCumulativeMints(processed.mints));
      setHolderDistribution(buildHolderDistribution(processed.holders));

      // Compute time-to-mint
      const minterAddrs = [...new Set(processed.mints.map((m) => m.to.toLowerCase()))];
      let ttmEntries = [];
      if (minterAddrs.length > 0) {
        try {
          const creationMap = await fetchAccountCreationTimestamps(minterAddrs);
          ttmEntries = computeTimeToMint(processed.mints, creationMap);
        } catch {
          // Non-critical
        }
      }
      setTimeToMint({
        entries: ttmEntries,
        summary: summariseTimeToMint(ttmEntries),
      });

      // Mint velocity (mints per hour)
      setMintVelocity(buildMintVelocity(processed.mints));

      // Sell pressure
      setSellPressure(
        computeSellPressure(processed.transfers.length, processed.mints.length)
      );

      // Mint timing heatmap
      setMintTimingHeatmap(buildMintTimingHeatmap(processed.mints));

      // Single-use wallet rate
      setSingleUseWalletRate(
        computeSingleUseWalletRate(processed.mints, processed.transfers)
      );

      // Holder growth over time
      setHolderGrowth(buildHolderGrowth(processed.mints, processed.transfers));

      // Update stats
      setStats({
        totalMints: processed.mints.length,
        totalTransfers: processed.transfers.length,
        uniqueHolders: processed.holders.length,
      });

      setLastRefresh(new Date());
    } catch (err) {
      if (currentContractRef.current === contractId) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [contractId, accountId]);

  // Reset state when contract changes
  useEffect(() => {
    setMints([]);
    setTransfers([]);
    setHolders([]);
    setDailyActivity([]);
    setCumulativeMints([]);
    setHolderDistribution([]);
    setContractInfo(null);
    setTimeToMint({ entries: [], summary: { avg: 0, median: 0, min: 0, max: 0, count: 0 } });
    setMintVelocity([]);
    setSellPressure({ pressure: 0, label: "No data", color: "text-gray-500" });
    setMintTimingHeatmap(null);
    setSingleUseWalletRate({ singleUseCount: 0, totalMinters: 0, rate: 0 });
    setHolderGrowth([]);
    setStats({ totalMints: 0, totalTransfers: 0, uniqueHolders: 0 });
    setLastRefresh(null);
    setError(null);
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
    timeToMint,
    mintVelocity,
    sellPressure,
    mintTimingHeatmap,
    singleUseWalletRate,
    holderGrowth,
    refresh,
  };
}
