import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * Displays a chart of unique holder count over time.
 *
 * @param {{ date: string, holders: number }[]} data
 */
export default function HolderGrowthChart({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
      <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <span>📈</span> Holder Growth Over Time
      </h4>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="holderGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#e5e7eb",
            }}
          />
          <Area
            type="monotone"
            dataKey="holders"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#holderGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
