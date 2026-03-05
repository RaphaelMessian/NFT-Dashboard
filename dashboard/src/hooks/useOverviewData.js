import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchTransferLogs,
  processTransferLogs,
  fetchAccountCreations,
  fetchContractInfo,
  fetchAccountCreationTimestamps,
  buildDailyActivity,
  buildCumulativeMints,
  buildHolderDistribution,
} from "../api/mirrorNode";
import {
  computeReturnRates,
  computeCumulativeUniqueMinters,
  computeLapsedReactivation,
  computeTimeToMint,
  summariseTimeToMint,
  formatDuration,
  computeMultiRaceHolders,
  buildMintVelocity,
  computeSellPressure,
  buildChurnFunnel,
  computeSingleUseWalletRate,
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
  // Per-contract time-to-mint summaries
  const [timeToMintByContract, setTimeToMintByContract] = useState([]);
  // New: multi-race holders
  const [multiRaceHolders, setMultiRaceHolders] = useState([]);
  const [churnFunnel, setChurnFunnel] = useState([]);
  const [sellPressureByContract, setSellPressureByContract] = useState([]);
  const [singleUseRateByContract, setSingleUseRateByContract] = useState([]);

  const contractsRef = useRef(contracts);
  contractsRef.current = contracts;

  const refresh = useCallback(async () => {
    if (contracts.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch data for all contracts in parallel
      const results = await Promise.all(
        contracts.map(async (c) => {
          try {
            const [info, rawLogs] = await Promise.all([
              fetchContractInfo(c.contractId).catch(() => null),
              fetchTransferLogs(c.contractId),
            ]);
            const processed = processTransferLogs(rawLogs);
            // Collect unique minter addresses for this race
            const minterSet = new Set(
              processed.mints.map((m) => m.to.toLowerCase())
            );
            return {
              label: c.label,
              contractId: c.contractId,
              info,
              mints: processed.mints.length,
              mintsList: processed.mints,
              transfers: processed.transfers.length,
              transfersList: processed.transfers,
              holders: processed.holders.length,
              totalSupply: processed.mints.length,
              holdersList: processed.holders,
              minterSet,
              error: null,
            };
          } catch (err) {
            return {
              label: c.label,
              contractId: c.contractId,
              info: null,
              mints: 0,
              mintsList: [],
              transfers: 0,
              transfersList: [],
              holders: 0,
              totalSupply: 0,
              holdersList: [],
              minterSet: new Set(),
              error: err.message,
            };
          }
        })
      );

      // Bail if contracts changed while loading
      if (contractsRef.current !== contracts) return;

      // ── Cross-race analytics ──

      const minterSets = results.map((r) => r.minterSet);

      // Return rates (Race N → N+1)
      const rates = computeReturnRates(minterSets);
      setReturnRates(rates);

      // Cumulative unique minters
      const cumUnique = computeCumulativeUniqueMinters(minterSets);
      setCumulativeUniqueMinters(cumUnique);

      // Lapsed wallet reactivation
      const lapsed = computeLapsedReactivation(minterSets);
      setLapsedReactivation(lapsed);

      // ── Time-to-mint (needs account creation timestamps) ──

      // Collect all unique minter addresses across all races
      const allMinterAddrs = new Set();
      for (const r of results) {
        for (const addr of r.minterSet) allMinterAddrs.add(addr);
      }

      let accountCreationMap = new Map();
      if (allMinterAddrs.size > 0) {
        try {
          accountCreationMap = await fetchAccountCreationTimestamps(
            [...allMinterAddrs]
          );
        } catch {
          // Non-critical
        }
      }

      // Compute per-contract time-to-mint
      const ttmByContract = results.map((r) => {
        const entries = computeTimeToMint(r.mintsList, accountCreationMap);
        const summary = summariseTimeToMint(entries);
        return {
          label: r.label,
          contractId: r.contractId,
          entries,
          summary,
        };
      });
      setTimeToMintByContract(ttmByContract);

      // ── Multi-race holders ──
      const holdersByRace = results.map((r) => r.holdersList);
      const raceLabels = results.map((r) => r.label);
      const multiRace = computeMultiRaceHolders(holdersByRace, raceLabels);
      setMultiRaceHolders(multiRace);

      // ── Churn funnel ──
      setChurnFunnel(buildChurnFunnel(minterSets));

      // ── Sell Pressure per contract ──
      setSellPressureByContract(
        results.map((r) => {
          const sp = computeSellPressure(r.transfers, r.mints);
          return {
            contractLabel: r.label,
            contractId: r.contractId,
            pressure: sp.pressure,
            pressureLabel: sp.label,
            pressureColor: sp.color,
          };
        })
      );

      // ── Single-use wallet rate per contract ──
      setSingleUseRateByContract(
        results.map((r) => ({
          label: r.label,
          contractId: r.contractId,
          ...computeSingleUseWalletRate(r.mintsList, r.transfersList),
        }))
      );

      // ── Aggregated totals ──

      setContractSummaries(
        results.map((r, i) => ({
          ...r,
          ttmSummary: ttmByContract[i].summary,
        }))
      );

      const allHolderAddresses = new Set();
      let totalMints = 0;
      let totalTransfers = 0;
      for (const r of results) {
        totalMints += r.mints;
        totalTransfers += r.transfers;
        for (const h of r.holdersList) {
          allHolderAddresses.add(h.address);
        }
      }

      setTotals({
        totalMints,
        totalTransfers,
        uniqueHolders: allHolderAddresses.size,
        totalSupply: totalMints,
      });

      // Fetch wallet creation count (account-level)
      let wallets = 0;
      let creationsList = [];
      if (accountId) {
        try {
          creationsList = await fetchAccountCreations(accountId);
          wallets = creationsList.length;
        } catch {
          // Non-critical
        }
      }
      setWalletsCreated(wallets);

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
    timeToMintByContract,
    multiRaceHolders,
    churnFunnel,
    sellPressureByContract,
    singleUseRateByContract,
    refresh,
  };
}
