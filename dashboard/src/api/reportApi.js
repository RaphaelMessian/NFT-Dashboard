/**
 * API client for the report backend (Express + MongoDB).
 * Fetches snapshot data from the server.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

export async function fetchSnapshots() {
  const res = await fetch(`${API_BASE}/api/snapshots`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchLatestSnapshot() {
  const res = await fetch(`${API_BASE}/api/snapshots/latest`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchSnapshotById(id) {
  const res = await fetch(`${API_BASE}/api/snapshots/${id}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchMints(snapshotId, contractId) {
  const params = new URLSearchParams();
  if (snapshotId) params.set("snapshotId", snapshotId);
  if (contractId) params.set("contractId", contractId);
  const res = await fetch(`${API_BASE}/api/mints?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchTransfers(snapshotId, contractId) {
  const params = new URLSearchParams();
  if (snapshotId) params.set("snapshotId", snapshotId);
  if (contractId) params.set("contractId", contractId);
  const res = await fetch(`${API_BASE}/api/transfers?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
