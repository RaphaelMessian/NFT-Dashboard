import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * Mint velocity chart — mints per hour as a bar chart.
 */
export default function MintVelocityChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <span>⚡</span> Mint Velocity
        </h3>
        <p className="text-gray-600 text-sm text-center py-8">
          No mint data yet
        </p>
      </div>
    );
  }

  // Find peak hour
  const peak = data.reduce(
    (max, d) => (d.count > max.count ? d : max),
    data[0]
  );

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>⚡</span> Mint Velocity
          <span className="text-xs text-gray-500 font-normal">(mints / hour)</span>
        </h3>
        {peak && (
          <span className="text-xs text-amber-400">
            Peak: {peak.count} mints — {peak.hour}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="hour"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={{ stroke: "#374151" }}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={{ stroke: "#374151" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Bar
            dataKey="count"
            name="Mints"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
