// index.js

// Set dimensions
const width = 800;
const height = 600;
const barHeight = 200;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

// Create SVG for map
const svgMap = d3.select("#map")
  .attr("width", width)
  .attr("height", height);

// Create SVG for bar chart
const svgBar = d3.select("#barchart")
  .attr("width", width)
  .attr("height", barHeight);

// Color scale for grades
const colorScale = d3.scaleOrdinal()
  .domain(["A", "B", "C", "D"])
  .range(["green", "lightgreen", "orange", "red"]);

// Tooltip div
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Load data
Promise.all([
  d3.json("manhattan.geojson"), // Manhattan GeoJSON
  d3.csv("data.csv")            // Your building data
]).then(([geoData, data]) => {

  // Convert lat/lon to numbers
  data.forEach(d => {
    d.latitude = +d.lat;
    d.longitude = +d.long;
    if (isNaN(d.latitude) || isNaN(d.longitude)) {
      console.warn("Invalid coordinates:", d);
    }
  });

  // Map projection
  const projection = d3.geoMercator()
    .fitSize([width, height], geoData);

  const path = d3.geoPath().projection(projection);

  // Draw Manhattan map
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
    .attr("fill", d => {
      const grade = d.energy_grade;
      if (!grade || !colorScale.domain().includes(grade)) return "blue"; // fallback
      return colorScale(grade);
    })
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

  // Prepare bar chart data: count per grade
  const gradeCounts = Array.from(
    d3.rollup(data, v => v.length, d => d.energy_grade ?? "Unknown"), 
    ([grade, count]) => ({ grade, count })
  );

  // X scale for bar chart
  const x = d3.scaleBand()
    .domain(gradeCounts.map(d => d.grade))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  // Y scale for bar chart
  const y = d3.scaleLinear()
    .domain([0, d3.max(gradeCounts, d => d.count)]).nice()
    .range([barHeight - margin.bottom, margin.top]);
  // Convert lat/lon to numbers and add small jitter for overlapping points
  const jitter = 0.0001; // tiny offset
  data.forEach(d => {
    d.latitude = +d.lat + (Math.random() - 0.5) * jitter;
    d.longitude = +d.long + (Math.random() - 0.5) * jitter;

    // Optional: log to see if any NaNs exist
    if (isNaN(d.latitude) || isNaN(d.longitude)) {
      console.warn("Invalid coordinates:", d);
    }
  });
  // Draw bars
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
      // Highlight buildings of this grade
      buildings.attr("opacity", b => (b.energy_grade === d.grade ? 1 : 0.2));
    });

  // Add axes
  svgBar.append("g")
    .attr("transform", `translate(0,${barHeight - margin.bottom})`)
    .call(d3.axisBottom(x));

  svgBar.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

}).catch(err => {
  console.error("Error loading data:", err);
});