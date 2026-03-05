import React from "react";

const CARDS = [
  {
    key: "totalMints",
    label: "Total Minted",
    icon: "🎨",
    color: "from-green-500/20 to-green-600/10 border-green-500/30",
    textColor: "text-green-400",
  },
  {
    key: "totalTransfers",
    label: "Total Transfers",
    icon: "🔄",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    textColor: "text-blue-400",
  },
  {
    key: "uniqueHolders",
    label: "Unique Holders",
    icon: "👛",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    textColor: "text-purple-400",
  },
  {
    key: "walletsCreated",
    label: "Wallets Created",
    icon: "➕",
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    textColor: "text-amber-400",
  },
];

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-5`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-medium">{card.label}</p>
              <p className={`text-3xl font-bold mt-1 ${card.textColor}`}>
                {stats[card.key]?.toLocaleString() ?? 0}
              </p>
            </div>
            <span className="text-3xl opacity-70">{card.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
