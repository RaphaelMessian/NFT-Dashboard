import React from "react";

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatTime(date) {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityTable({ mints, transfers }) {
  // Merge and sort all events by timestamp (newest first)
  const allEvents = [
    ...mints.map((m) => ({ ...m, type: "Mint" })),
    ...transfers.map((t) => ({ ...t, type: "Transfer" })),
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (allEvents.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <p className="text-gray-500">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
      <h3 className="text-lg font-semibold mb-4">
        Recent Activity{" "}
        <span className="text-sm font-normal text-gray-400">
          ({allEvents.length} events)
        </span>
      </h3>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">
                Type
              </th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">
                Token ID
              </th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">
                From
              </th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">
                To
              </th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {allEvents.slice(0, 50).map((event, i) => (
              <tr
                key={`${event.transactionHash}-${event.tokenId}-${i}`}
                className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
              >
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      event.type === "Mint"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {event.type === "Mint" ? "🎨 Mint" : "🔄 Transfer"}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-white">
                  #{event.tokenId}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-gray-400">
                  {event.isMint ? (
                    <span className="text-gray-600">—</span>
                  ) : (
                    <a
                      href={`https://hashscan.io/testnet/account/${event.from}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-gray-200"
                    >
                      {truncateAddress(event.from)}
                    </a>
                  )}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs">
                  <a
                    href={`https://hashscan.io/testnet/account/${event.to}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300"
                  >
                    {truncateAddress(event.to)}
                  </a>
                </td>
                <td className="py-2.5 px-3 text-right text-gray-400 text-xs">
                  {formatTime(event.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
