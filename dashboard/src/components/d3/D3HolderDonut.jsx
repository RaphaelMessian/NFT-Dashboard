import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 Donut chart for holder distribution.
 * @param {{ data: { name: string, count: number }[] }} props
 */
export default function D3HolderDonut({ data, width = 280, height = 280 }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const radius = Math.min(width, height) / 2 - 10;
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal()
      .domain(data.map((d) => d.name))
      .range(["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"]);

    const pie = d3.pie().value((d) => d.count).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius + 6);

    const arcs = g
      .selectAll("path")
      .data(pie(data))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => color(d.data.name))
      .attr("stroke", "#111827")
      .attr("stroke-width", 2)
      .style("opacity", 0.85)
      .on("mouseenter", function (event, d) {
        d3.select(this).transition().duration(150).attr("d", arcHover).style("opacity", 1);
      })
      .on("mouseleave", function (event, d) {
        d3.select(this).transition().duration(150).attr("d", arc).style("opacity", 0.85);
      });

    // Labels
    const labelArc = d3.arc().innerRadius(radius * 0.8).outerRadius(radius * 0.8);
    g.selectAll("text")
      .data(pie(data))
      .join("text")
      .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "10px")
      .text((d) => d.data.count > 0 ? `${d.data.name}` : "");

    // Center text
    const total = data.reduce((s, d) => s + d.count, 0);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "#9ca3af")
      .attr("font-size", "12px")
      .text("Holders");
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("fill", "white")
      .attr("font-size", "22px")
      .attr("font-weight", "bold")
      .text(total);
  }, [data, width, height]);

  return <svg ref={svgRef} />;
}
