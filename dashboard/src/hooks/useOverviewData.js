import { useState, useCallback, useEffect, useRef } from "react";
import { fetchLatestSnapshot } from "../api/reportApi";
import {
  computeReturnRates,
  computeCumulativeUniqueMinters,
  computeLapsedReactivation,
} from "../api/analytics";

/**
 * Hook that fetches and aggregates data across ALL configured contracts.
 * Also fetches wallet creation count (account-level, not per-contract).
 * Computes cross-race analytics: return rate, cumulative unique minters,
 * lapsed wallet reactivation, and per-contract time-to-mint.
 *
 * @param {{ label: string, contractId: string }[]} contracts
 * @param {string} accountId
 */
export function useOverviewData(contracts, accountId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [walletsCreated, setWalletsCreated] = useState(0);
  const [contractSummaries, setContractSummaries] = useState([]);
  // Aggregate stats across all contracts
  const [totals, setTotals] = useState({
    totalMints: 0,
    totalTransfers: 0,
    uniqueHolders: 0,
    totalSupply: 0,
  });

  // Cross-race analytics
  const [returnRates, setReturnRates] = useState([]);
  const [cumulativeUniqueMinters, setCumulativeUniqueMinters] = useState([]);
  const [lapsedReactivation, setLapsedReactivation] = useState([]);
  // New: multi-race holders
  const [multiRaceHolders, setMultiRaceHolders] = useState([]);
  const [churnFunnel, setChurnFunnel] = useState([]);
  const [sellPressureByContract, setSellPressureByContract] = useState([]);
  const [singleUseRateByContract, setSingleUseRateByContract] = useState([]);
  const [dailyActivity, setDailyActivity] = useState([]);

  const contractsRef = useRef(contracts);
  contractsRef.current = contracts;

  const refresh = useCallback(async () => {
    if (contracts.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const snapshot = await fetchLatestSnapshot();
      const snapshotContracts = snapshot?.contracts ?? [];
      const crossRace = snapshot?.crossRace ?? {};

      const minterSets = snapshotContracts.map((c) => new Set(c.minterAddresses ?? []));

      const summaries = snapshotContracts.map((c, i) => ({
        label: c.label,
        contractId: c.contractId,
        mints: c.stats.totalMints,
        transfers: c.stats.totalTransfers,
        holders: c.stats.uniqueHolders,
        totalSupply: c.stats.totalSupply,
        minterSet: minterSets[i],
        error: null,
      }));

      setContractSummaries(summaries);
      setTotals(snapshot.totals ?? { totalMints: 0, totalTransfers: 0, uniqueHolders: 0, totalSupply: 0 });
      setWalletsCreated(snapshot.walletsCreated ?? 0);
      setReturnRates(crossRace.returnRates ?? []);
      setMultiRaceHolders(crossRace.multiRaceHolders ?? []);
      setChurnFunnel(crossRace.churnFunnel ?? []);

      setSellPressureByContract(
        snapshotContracts.map((c) => ({
          contractLabel: c.label,
          contractId: c.contractId,
          ...(c.analytics.sellPressure ?? {}),
        }))
      );

      setSingleUseRateByContract(
        snapshotContracts.map((c) => ({
          label: c.label,
          contractId: c.contractId,
          ...(c.analytics.singleUseWalletRate ?? {}),
        }))
      );

      setCumulativeUniqueMinters(computeCumulativeUniqueMinters(minterSets));
      setLapsedReactivation(computeLapsedReactivation(minterSets));

      // Aggregate dailyActivity across all contracts
      const dayMap = {};
      for (const c of snapshotContracts) {
        for (const d of c.analytics?.dailyActivity ?? []) {
          if (!dayMap[d.date]) dayMap[d.date] = { date: d.date, mints: 0, transfers: 0 };
          dayMap[d.date].mints += d.mints ?? 0;
          dayMap[d.date].transfers += d.transfers ?? 0;
        }
      }
      setDailyActivity(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)));

      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contracts, accountId]);

  return {
    loading,
    error,
    lastRefresh,
    totals,
    walletsCreated,
    contractSummaries,
    // Cross-race analytics
    returnRates,
    cumulativeUniqueMinters,
    lapsedReactivation,
    multiRaceHolders,
    churnFunnel,
    sellPressureByContract,
    singleUseRateByContract,
    dailyActivity,
    refresh,
  };
}
