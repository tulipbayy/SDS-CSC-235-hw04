// Set dimensions
const width = 800;
const height = 600;
const barHeight = 200;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

// Create SVG for map
const svgMap = d3.select("#map")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Create SVG for bar chart
const svgBar = d3.select("#barchart")
  .attr("width", width)
  .attr("height", barHeight);

// Color scale
const colorScale = d3.scaleOrdinal()
  .domain(["A", "B", "C", "D"])
  .range(["green", "lightgreen", "orange", "red"]);

// Tooltip
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Load data
Promise.all([
  d3.json("manhattan.geojson"),
  d3.csv("data.csv")
]).then(([geoData, data]) => {

  // Convert + jitter coordinates
  const jitter = 0.0001;
  data.forEach(d => {
    d.latitude = +d.lat + (Math.random() - 0.5) * jitter;
    d.longitude = +d.long + (Math.random() - 0.5) * jitter;
  });

  // Projection
  const projection = d3.geoMercator()
    .fitSize([width, height], geoData);

  const path = d3.geoPath().projection(projection);

  // Draw map
  svgMap.selectAll("path")
    .data(geoData.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", "#eee")
    .attr("stroke", "#333");

  // Plot buildings
  const buildings = svgMap.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => projection([d.longitude, d.latitude])[0])
    .attr("cy", d => projection([d.longitude, d.latitude])[1])
    .attr("r", 6)
    .attr("fill", d => colorScale(d.energy_grade) || "blue")
    .attr("opacity", 0.8)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 9);

      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`
        <strong>${d.street_number || ""} ${d.street_name || ""}</strong><br/>
        Grade: ${d.energy_grade || "N/A"}<br/>
        Score: ${d.energy_score || "N/A"}
      `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 6);
      tooltip.transition().duration(500).style("opacity", 0);
    });

  // Bar chart data
  const gradeCounts = Array.from(
    d3.rollup(data, v => v.length, d => d.energy_grade ?? "Unknown"),
    ([grade, count]) => ({ grade, count })
  );

  // Scales
  const x = d3.scaleBand()
    .domain(gradeCounts.map(d => d.grade))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(gradeCounts, d => d.count)]).nice()
    .range([barHeight - margin.bottom, margin.top]);

  // Bars
  svgBar.selectAll("rect")
    .data(gradeCounts)
    .enter()
    .append("rect")
    .attr("x", d => x(d.grade))
    .attr("y", d => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d => barHeight - margin.bottom - y(d.count))
    .attr("fill", d => colorScale(d.grade) || "gray")
    .on("click", function(event, d) {
      buildings.attr("opacity", b =>
        (b.energy_grade === d.grade ? 1 : 0.2)
      );
    });

  // Axes
  svgBar.append("g")
    .attr("transform", `translate(0,${barHeight - margin.bottom})`)
    .call(d3.axisBottom(x));

  svgBar.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Reset interaction
  svgBar.on("dblclick", () => {
    buildings.attr("opacity", 0.8);
  });

  // Bar chart title
  svgBar.append("text")
    .attr("x", width / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .text("Distribution of Energy Grades");

  // Legend
  const legend = svgMap.append("g")
    .attr("transform", "translate(20,20)");

  const grades = ["A","B","C","D"];

  grades.forEach((g, i) => {
    legend.append("rect")
      .attr("x", 0)
      .attr("y", i * 20)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", colorScale(g));

    legend.append("text")
      .attr("x", 18)
      .attr("y", i * 20 + 10)
      .text(g);
  });

}).catch(err => {
  console.error("Error loading data:", err);
});
