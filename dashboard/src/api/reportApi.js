/**
 * API client for the report backend (Express + MongoDB).
 * Fetches snapshot data from the server.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchSnapshots() {
  return apiFetch(`${API_BASE}/api/snapshots`);
}

export async function fetchLatestSnapshot() {
  return apiFetch(`${API_BASE}/api/snapshots/latest`);
}

export async function fetchSnapshotById(id) {
  return apiFetch(`${API_BASE}/api/snapshots/${id}`);
}

export async function fetchMints(snapshotId, contractId) {
  const params = new URLSearchParams();
  if (snapshotId) params.set("snapshotId", snapshotId);
  if (contractId) params.set("contractId", contractId);
  return apiFetch(`${API_BASE}/api/mints?${params}`);
}

export async function fetchTransfers(snapshotId, contractId) {
  const params = new URLSearchParams();
  if (snapshotId) params.set("snapshotId", snapshotId);
  if (contractId) params.set("contractId", contractId);
  return apiFetch(`${API_BASE}/api/transfers?${params}`);
}

export async function fetchHolders(snapshotId, contractId) {
  const params = new URLSearchParams();
  if (snapshotId) params.set("snapshotId", snapshotId);
  if (contractId) params.set("contractId", contractId);
  return apiFetch(`${API_BASE}/api/holders?${params}`);
}
