/**
 * Parse dashboard configuration from Vite environment variables.
 *
 * VITE_NFT_CONTRACTS format: "Label1:0.0.XXXXX,Label2:0.0.YYYYY"
 * VITE_ACCOUNT_ID: "0.0.XXXXX"
 */

/**
 * Parse the VITE_NFT_CONTRACTS env var into an array of { label, contractId }.
 */
export function getContracts() {
  const raw = import.meta.env.VITE_NFT_CONTRACTS || "";
  if (!raw.trim()) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const colonIdx = entry.indexOf(":");
      if (colonIdx === -1) {
        // No label provided, use the contract ID as label
        return { label: entry, contractId: entry };
      }
      return {
        label: entry.slice(0, colonIdx).trim(),
        contractId: entry.slice(colonIdx + 1).trim(),
      };
    })
    .filter((c) => c.contractId);
}

/**
 * Get the creator account ID from env.
 */
export function getAccountId() {
  return import.meta.env.VITE_ACCOUNT_ID || "";
}
