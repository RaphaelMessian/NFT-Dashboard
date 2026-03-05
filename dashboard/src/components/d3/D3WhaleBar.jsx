import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 horizontal bar chart for whale watchlist.
 * Shows top holders with % of supply as bars.
 */
export default function D3WhaleBar({ data, width = 500, height = 300 }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 10, right: 60, bottom: 30, left: 100 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => shortAddr(d.address)))
      .range([0, h])
      .padding(0.25);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.pctSupply) * 1.15])
      .range([0, w]);

    // Bars
    g.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("y", (d) => y(shortAddr(d.address)))
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", 0)
      .attr("rx", 4)
      .attr("fill", (d, i) => i === 0 ? "#f59e0b" : i < 3 ? "#22c55e" : "#3b82f6")
      .transition()
      .duration(600)
      .delay((d, i) => i * 60)
      .attr("width", (d) => x(d.pctSupply));

    // % labels
    g.selectAll(".pct-label")
      .data(data)
      .join("text")
      .attr("class", "pct-label")
      .attr("x", (d) => x(d.pctSupply) + 5)
      .attr("y", (d) => y(shortAddr(d.address)) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", "#9ca3af")
      .attr("font-size", "11px")
      .text((d) => `${d.pctSupply.toFixed(1)}%`);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "11px")
      .attr("font-family", "monospace");
    g.select(".domain").attr("stroke", "#374151");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${d.toFixed(0)}%`))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px");
    g.selectAll(".domain").attr("stroke", "#374151");
    g.selectAll("line").attr("stroke", "#374151");
  }, [data, width, height]);

  return <svg ref={svgRef} />;
}

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
