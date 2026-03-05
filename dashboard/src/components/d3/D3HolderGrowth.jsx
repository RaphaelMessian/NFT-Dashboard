import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 area chart showing holder growth over time.
 * Expects an array of { date, holders } objects.
 */
export default function D3HolderGrowth({ data, width = 580, height = 260 }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 15, right: 20, bottom: 35, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parsed = data.map((d) => ({
      date: new Date(d.date),
      holders: d.holders,
    }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(parsed, (d) => d.date))
      .range([0, w]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.holders) * 1.1 || 1])
      .range([h, 0]);

    // Gradient fill
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "holderGrowthGrad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#6366f1").attr("stop-opacity", 0.5);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#6366f1").attr("stop-opacity", 0.05);

    // Area
    const area = d3
      .area()
      .x((d) => x(d.date))
      .y0(h)
      .y1((d) => y(d.holders))
      .curve(d3.curveMonotoneX);

    g.append("path").datum(parsed).attr("d", area).attr("fill", "url(#holderGrowthGrad)");

    // Line
    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.holders))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(parsed)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#818cf8")
      .attr("stroke-width", 2);

    // Dots
    g.selectAll("circle")
      .data(parsed)
      .join("circle")
      .attr("cx", (d) => x(d.date))
      .attr("cy", (d) => y(d.holders))
      .attr("r", 3)
      .attr("fill", "#818cf8")
      .append("title")
      .text(
        (d) =>
          `${d.date.toLocaleDateString()}: ${d.holders} holder${d.holders !== 1 ? "s" : ""}`
      );

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px");

    g.selectAll(".domain, .tick line").attr("stroke", "#374151");
  }, [data, width, height]);

  return <svg ref={svgRef} />;
}
