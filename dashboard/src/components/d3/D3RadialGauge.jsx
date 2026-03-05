import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 radial gauge for a 0–1 metric (sell pressure, token velocity, etc.).
 * Shows a coloured arc with the value, a label, and a classification.
 */
export default function D3RadialGauge({
  value = 0,
  label = "",
  classification = "",
  color = "#6366f1",
  width = 160,
  height = 160,
}) {
  const svgRef = useRef();

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 12;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${cx},${cy})`);

    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;
    const totalAngle = endAngle - startAngle;

    // BG arc
    g.append("path")
      .attr(
        "d",
        d3
          .arc()
          .innerRadius(radius - 14)
          .outerRadius(radius)
          .startAngle(startAngle)
          .endAngle(endAngle)()
      )
      .attr("fill", "#374151");

    // Value arc
    const clampedVal = Math.max(0, Math.min(1, value));
    g.append("path")
      .attr(
        "d",
        d3
          .arc()
          .innerRadius(radius - 14)
          .outerRadius(radius)
          .startAngle(startAngle)
          .endAngle(startAngle + clampedVal * totalAngle)()
      )
      .attr("fill", color);

    // Value text
    g.append("text")
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#f9fafb")
      .attr("font-size", "20px")
      .attr("font-weight", "700")
      .text(typeof value === "number" ? (value * 100).toFixed(0) + "%" : value);

    // Classification
    if (classification) {
      g.append("text")
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .attr("fill", color)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .text(classification);
    }

    // Label below
    if (label) {
      g.append("text")
        .attr("y", radius + 6)
        .attr("text-anchor", "middle")
        .attr("fill", "#9ca3af")
        .attr("font-size", "10px")
        .text(label);
    }
  }, [value, label, classification, color, width, height]);

  return <svg ref={svgRef} />;
}
