import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 Heatmap for mint timing (hour × day-of-week).
 */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function D3MintHeatmap({ data, width = 580, height = 220 }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.dayHourGrid) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 10, bottom: 30, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const cellW = w / 24;
    const cellH = h / 7;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Flatten grid
    const cells = [];
    let maxVal = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const val = data.dayHourGrid[d][h];
        if (val > maxVal) maxVal = val;
        cells.push({ day: d, hour: h, value: val });
      }
    }

    const color = d3
      .scaleSequential()
      .domain([0, maxVal || 1])
      .interpolator(d3.interpolateGnBu);

    // Cells
    g.selectAll("rect")
      .data(cells)
      .join("rect")
      .attr("x", (d) => d.hour * cellW)
      .attr("y", (d) => d.day * cellH)
      .attr("width", cellW - 1)
      .attr("height", cellH - 1)
      .attr("rx", 2)
      .attr("fill", (d) => (d.value === 0 ? "#1f2937" : color(d.value)))
      .attr("stroke", (d) =>
        d.day === data.peakDay && d.hour === data.peakHour ? "#22c55e" : "none"
      )
      .attr("stroke-width", 2)
      .append("title")
      .text((d) => `${DAYS[d.day]} ${d.hour}:00 — ${d.value} mints`);

    // Count labels inside cells
    g.selectAll("text.cell-label")
      .data(cells.filter((c) => c.value > 0))
      .join("text")
      .attr("class", "cell-label")
      .attr("x", (d) => d.hour * cellW + cellW / 2)
      .attr("y", (d) => d.day * cellH + cellH / 2)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "white")
      .attr("font-size", "9px")
      .text((d) => d.value);

    // Y-axis labels (day names)
    g.selectAll("text.day-label")
      .data(DAYS)
      .join("text")
      .attr("class", "day-label")
      .attr("x", -5)
      .attr("y", (d, i) => i * cellH + cellH / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px")
      .text((d) => d);

    // X-axis labels (hours, every 3rd)
    g.selectAll("text.hour-label")
      .data(HOURS.filter((h) => h % 3 === 0))
      .join("text")
      .attr("class", "hour-label")
      .attr("x", (d) => d * cellW + cellW / 2)
      .attr("y", 7 * cellH + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px")
      .text((d) => `${d}h`);
  }, [data, width, height]);

  return <svg ref={svgRef} />;
}
