import React from "react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0")
);

/**
 * A heatmap grid showing mint activity by hour-of-day × day-of-week.
 * Useful for detecting bot patterns (e.g. uniform activity at odd hours).
 *
 * @param {{ dayHourGrid: number[][], peakHour: number, peakDay: number }} props
 */
export default function MintTimingHeatmap({ data }) {
  if (!data || !data.dayHourGrid) return null;

  const { dayHourGrid, peakHour, peakDay } = data;

  // Find max value for colour scaling
  let maxVal = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (dayHourGrid[d][h] > maxVal) maxVal = dayHourGrid[d][h];
    }
  }

  const cellColor = (val) => {
    if (val === 0 || maxVal === 0) return "bg-gray-800/40";
    const ratio = val / maxVal;
    if (ratio < 0.25) return "bg-green-900/60";
    if (ratio < 0.5) return "bg-green-700/60";
    if (ratio < 0.75) return "bg-green-500/60";
    return "bg-green-400/80";
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-5">
      <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
        <span>🕐</span> Mint Timing Heatmap
        <span className="text-xs text-gray-500 font-normal">
          (UTC, hour-of-day × day-of-week)
        </span>
      </h4>
      <p className="text-xs text-gray-600 mb-4">
        Uniform distribution across off-hours may indicate bot activity. Peak:{" "}
        <span className="text-green-400 font-medium">
          {DAY_LABELS[peakDay]} {HOUR_LABELS[peakHour]}:00
        </span>
      </p>

      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="pr-2 text-gray-500 text-left w-10"></th>
              {HOUR_LABELS.map((h) => (
                <th key={h} className="px-0.5 text-gray-600 font-normal w-6 text-center">
                  {parseInt(h) % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((day, d) => (
              <tr key={day}>
                <td className="pr-2 text-gray-500 font-medium">{day}</td>
                {HOUR_LABELS.map((_, h) => {
                  const val = dayHourGrid[d][h];
                  const isPeak = d === peakDay && h === peakHour;
                  return (
                    <td key={h} className="px-0.5 py-0.5">
                      <div
                        className={`w-5 h-5 rounded-sm flex items-center justify-center text-[9px] ${cellColor(val)} ${
                          isPeak ? "ring-1 ring-green-400" : ""
                        }`}
                        title={`${day} ${HOUR_LABELS[h]}:00 — ${val} mint${val !== 1 ? "s" : ""}`}
                      >
                        {val > 0 ? val : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span>Less</span>
        <div className="w-4 h-4 rounded-sm bg-gray-800/40" />
        <div className="w-4 h-4 rounded-sm bg-green-900/60" />
        <div className="w-4 h-4 rounded-sm bg-green-700/60" />
        <div className="w-4 h-4 rounded-sm bg-green-500/60" />
        <div className="w-4 h-4 rounded-sm bg-green-400/80" />
        <span>More</span>
      </div>
    </div>
  );
}
