import React from "react";

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function HoldersTable({ holders }) {
  if (!holders || holders.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
        <h3 className="text-lg font-semibold mb-4">Top Holders</h3>
        <p className="text-gray-500">No holders yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
      <h3 className="text-lg font-semibold mb-4">
        Top Holders{" "}
        <span className="text-sm font-normal text-gray-400">
          ({holders.length} total)
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">#</th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">
                Address
              </th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">
                NFTs Held
              </th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">
                Token IDs
              </th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 20).map((holder, i) => (
              <tr
                key={holder.address}
                className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
              >
                <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                <td className="py-2.5 px-3">
                  <a
                    href={`https://hashscan.io/testnet/account/${holder.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 font-mono text-xs"
                  >
                    {truncateAddress(holder.address)}
                  </a>
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-white">
                  {holder.tokenCount}
                </td>
                <td className="py-2.5 px-3 text-right text-gray-400 font-mono text-xs">
                  {holder.tokenIds.slice(0, 5).join(", ")}
                  {holder.tokenIds.length > 5
                    ? ` +${holder.tokenIds.length - 5} more`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
