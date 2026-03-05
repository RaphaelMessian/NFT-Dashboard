import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function ActivityChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
        <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No activity data yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
      <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="mintGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="transferGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(d) => d.slice(5)} // MM-DD
          />
          <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#f3f4f6",
            }}
          />
          <Legend />
          <Area
            name="Mints"
            type="monotone"
            dataKey="mints"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#mintGrad)"
          />
          <Area
            name="Transfers"
            type="monotone"
            dataKey="transfers"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#transferGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
