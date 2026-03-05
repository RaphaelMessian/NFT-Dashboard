import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 horizontal funnel/bar chart for churn funnel data.
 * Expects an array of { label, count } (ordered from widest to narrowest).
 */
export default function D3ChurnFunnel({ data, width = 500, height = 200 }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 10, right: 20, bottom: 10, left: 130 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const barH = Math.min(h / data.length - 4, 36);

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const maxVal = d3.max(data, (d) => d.count) || 1;

    const colors = d3
      .scaleSequential()
      .domain([0, data.length - 1])
      .interpolator(d3.interpolateRgbBasis(["#6366f1", "#a78bfa", "#ddd6fe"]));

    // Bars (centered to create funnel effect)
    data.forEach((d, i) => {
      const barW = (d.count / maxVal) * w;
      const xOff = (w - barW) / 2;
      const yPos = i * (barH + 6);

      g.append("rect")
        .attr("x", xOff)
        .attr("y", yPos)
        .attr("width", barW)
        .attr("height", barH)
        .attr("rx", 4)
        .attr("fill", colors(i))
        .attr("opacity", 0.85);

      // Count inside bar
      g.append("text")
        .attr("x", w / 2)
        .attr("y", yPos + barH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", i < data.length / 2 ? "white" : "#1f2937")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .text(d.count);
    });

    // Labels on left
    data.forEach((d, i) => {
      const yPos = i * (barH + 6);
      g.append("text")
        .attr("x", -8)
        .attr("y", yPos + barH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("fill", "#d1d5db")
        .attr("font-size", "11px")
        .text(d.label);
    });

    // Conversion % between stages
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1].count === 0) continue;
      const pct = ((data[i].count / data[i - 1].count) * 100).toFixed(0);
      const yPos = i * (barH + 6) - 3;
      g.append("text")
        .attr("x", w + 15)
        .attr("y", yPos)
        .attr("text-anchor", "start")
        .attr("fill", "#9ca3af")
        .attr("font-size", "9px")
        .text(`${pct}%`);
    }
  }, [data, width, height]);

  return <svg ref={svgRef} />;
}
