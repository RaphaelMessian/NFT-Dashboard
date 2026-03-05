import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 gauge / arc chart for the Gini coefficient (0–1).
 * Shows a semicircle arc colored green → yellow → red.
 */
export default function D3GiniGauge({ value = 0, label = "", width = 220, height = 140 }) {
  const svgRef = useRef();

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const cx = width / 2;
    const cy = height - 15;
    const radius = Math.min(cx - 10, cy - 10);

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${cx},${cy})`);

    // Background arc
    const bgArc = d3
      .arc()
      .innerRadius(radius - 18)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    // Gradient — split into segments
    const segments = 50;
    const colorScale = d3
      .scaleLinear()
      .domain([0, 0.35, 0.65, 1])
      .range(["#22c55e", "#eab308", "#f97316", "#ef4444"]);

    for (let i = 0; i < segments; i++) {
      const startFrac = i / segments;
      const endFrac = (i + 1) / segments;
      const sAngle = -Math.PI / 2 + startFrac * Math.PI;
      const eAngle = -Math.PI / 2 + endFrac * Math.PI;

      g.append("path")
        .attr(
          "d",
          d3
            .arc()
            .innerRadius(radius - 18)
            .outerRadius(radius)
            .startAngle(sAngle)
            .endAngle(eAngle)()
        )
        .attr("fill", colorScale(startFrac))
        .attr("opacity", 0.3);
    }

    // Value arc
    const clampedVal = Math.max(0, Math.min(1, value));
    const valueAngle = -Math.PI / 2 + clampedVal * Math.PI;

    const valueArc = d3
      .arc()
      .innerRadius(radius - 18)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(valueAngle);

    // Dynamic color segments for value arc
    const valSegments = Math.ceil(clampedVal * segments);
    for (let i = 0; i < valSegments; i++) {
      const startFrac = i / segments;
      const endFrac = Math.min((i + 1) / segments, clampedVal);
      const sAngle = -Math.PI / 2 + startFrac * Math.PI;
      const eAngle = -Math.PI / 2 + endFrac * Math.PI;

      g.append("path")
        .attr(
          "d",
          d3
            .arc()
            .innerRadius(radius - 18)
            .outerRadius(radius)
            .startAngle(sAngle)
            .endAngle(eAngle)()
        )
        .attr("fill", colorScale(startFrac));
    }

    // Needle
    const needleAngle = -Math.PI / 2 + clampedVal * Math.PI;
    const needleLen = radius - 25;
    g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", needleLen * Math.cos(needleAngle - Math.PI / 2))
      .attr("y2", needleLen * Math.sin(needleAngle - Math.PI / 2))
      .attr("stroke", "#f8fafc")
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round");

    g.append("circle").attr("r", 4).attr("fill", "#f8fafc");

    // Value label
    g.append("text")
      .attr("y", -radius / 3)
      .attr("text-anchor", "middle")
      .attr("fill", colorScale(clampedVal))
      .attr("font-size", "22px")
      .attr("font-weight", "700")
      .text(clampedVal.toFixed(3));

    // Classification label
    if (label) {
      g.append("text")
        .attr("y", -radius / 3 + 18)
        .attr("text-anchor", "middle")
        .attr("fill", "#9ca3af")
        .attr("font-size", "11px")
        .text(label);
    }

    // Min / Max
    g.append("text")
      .attr("x", -radius + 5)
      .attr("y", 14)
      .attr("text-anchor", "start")
      .attr("fill", "#6b7280")
      .attr("font-size", "9px")
      .text("0");

    g.append("text")
      .attr("x", radius - 5)
      .attr("y", 14)
      .attr("text-anchor", "end")
      .attr("fill", "#6b7280")
      .attr("font-size", "9px")
      .text("1");
  }, [value, label, width, height]);

  return <svg ref={svgRef} />;
}
