import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * D3 grouped / stacked bar chart for mint velocity (mints per day).
 * Expects an array of { date, count } objects.
 */
export default function D3MintVelocity({ data, width = 580, height = 220 }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 15, right: 10, bottom: 35, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parsed = data.map((d) => ({
      date: new Date(d.date),
      count: d.count,
    }));

    const x = d3
      .scaleBand()
      .domain(parsed.map((d) => d.date))
      .range([0, w])
      .padding(0.25);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.count) * 1.15 || 1])
      .range([h, 0]);

    // Bars
    g.selectAll("rect")
      .data(parsed)
      .join("rect")
      .attr("x", (d) => x(d.date))
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.count))
      .attr("rx", 3)
      .attr("fill", "#818cf8")
      .attr("opacity", 0.85)
      .append("title")
      .text((d) => `${d.date.toLocaleDateString()}: ${d.count} mints`);

    // Count labels on top
    g.selectAll("text.bar-label")
      .data(parsed)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => x(d.date) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.count) - 4)
      .attr("text-anchor", "middle")
      .attr("fill", "#d1d5db")
      .attr("font-size", "10px")
      .text((d) => d.count);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat(d3.timeFormat("%b %d"))
          .tickValues(
            parsed.length > 10
              ? parsed.filter((_, i) => i % Math.ceil(parsed.length / 8) === 0).map((d) => d.date)
              : parsed.map((d) => d.date)
          )
      )
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px")
      .attr("transform", "rotate(-25)")
      .attr("text-anchor", "end");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
      .selectAll("text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "10px");

    g.selectAll(".domain, .tick line").attr("stroke", "#374151");
  }, [data, width, height]);

  return <svg ref={svgRef} />;
}
