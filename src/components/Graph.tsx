"use client";

import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

interface StockData {
  date: Date;
  value: number;
  percentageGrowth: number;
  symbol: string;
}

type DateRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

const stockSymbols = ["Stock A", "Stock B"];
const colors = ["#4ade80", "#ef4444"];

const generateDummyData = (days: number, symbol: string): StockData[] => {
  const data: StockData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  let value = 10000; // Starting with $10,000 invested

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dailyChange = (Math.random() - 0.5) * 200; // Random daily change
    value += dailyChange;
    const percentageGrowth = ((value - 10000) / 10000) * 100; // Calculate percentage growth
    data.push({ date, value, percentageGrowth, symbol });
  }

  return data;
};

export default function StockGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>("1M");
  const [data, setData] = useState<StockData[]>([]);
  const [activeTabPosition, setActiveTabPosition] = useState(2); // Default to "1M"
  const [sliderStyle, setSliderStyle] = useState({ width: 0, left: 0 });
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<HTMLDivElement[]>([]);
  const [currentValues, setCurrentValues] = useState<{ [key: string]: number }>({});
  const [currentPercentages, setCurrentPercentages] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const daysMap: Record<DateRange, number> = {
      "1D": 1,
      "1W": 7,
      "1M": 30,
      "3M": 90,
      "1Y": 365,
      "ALL": 1825,
    };
    const newData = stockSymbols.flatMap((symbol) =>
      generateDummyData(daysMap[dateRange], symbol)
    );
    setData(newData);
  }, [dateRange]);

  useEffect(() => {
    if (data.length === 0) return;

    const margin = { top: 20, right: 90, bottom: 20, left: 90 };
    const width = Math.min(1200, window.innerWidth - 40) - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .html(null) // Clear previous content
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleTime()
      .domain(d3.extent(data, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([d3.min(data, (d) => d.value) as number, d3.max(data, (d) => d.value) as number])
      .range([height, 0]);

    const colorScale = d3.scaleOrdinal<string>().domain(stockSymbols).range(colors);

    const line = d3.line<StockData>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value));
      
    const groupedData = d3.group(data, (d) => d.symbol);

    // Add clipPath for the left side of the graph
    const leftClipPath = svg.append("defs")
      .append("clipPath")
        .attr("id", "left-clip-path")
      .append("rect")
        .attr("width", width)
        .attr("height", height);

    // Add clipPath for the right side of the graph
    const rightClipPath = svg.append("defs")
      .append("clipPath")
        .attr("id", "right-clip-path")
      .append("rect")
        .attr("x", width)
        .attr("width", 0)
        .attr("height", height);

    groupedData.forEach((stockData, symbol) => {
      // Left side of the graph (full opacity)
      svg
        .append("g")
        .attr("clip-path", "url(#left-clip-path)")
        .append("path")
        .datum(stockData)
        .attr("fill", "none")
        .attr("stroke", colorScale(symbol))
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("class", `line-${symbol.replace(" ", "-")}`);

      // Right side of the graph (reduced opacity)
      svg
        .append("g")
        .attr("clip-path", "url(#right-clip-path)")
        .append("path")
        .datum(stockData)
        .attr("fill", "none")
        .attr("stroke", colorScale(symbol))
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("class", `line-${symbol.replace(" ", "-")}`)
        .style("opacity", 0.25);
    });

    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .attr("color", "#718096");

    svg.append("g")
      .call(d3.axisLeft(yScale).tickFormat((d) => `$${d}`))
      .attr("color", "#718096");

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#E2E8F0")
      .text("Total Investment Value (CAD)");

    const focus = svg.append("g").attr("class", "focus").style("display", "none");

    focus
      .append("line")
      .attr("class", "x-hover-line hover-line")
      .attr("y1", 0)
      .attr("y2", height)
      .style("stroke", "#718096")
      .style("stroke-width", "1px")
      .style("stroke-dasharray", "3,3");

    stockSymbols.forEach((symbol) => {
      focus
        .append("circle")
        .attr("r", 5)
        .attr("fill", colorScale(symbol))
        .attr("class", `circle-${symbol.replace(" ", "-")}`);
    });

    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => focus.style("display", null))
      .on("mouseout", () => focus.style("display", "none"))
      .on("mousemove", mousemove);

    function mousemove(event: MouseEvent) {
      const [mouseX] = d3.pointer(event);
      const bisect = d3.bisector((d: StockData) => d.date).left;
      const x0 = xScale.invert(mouseX);

      let closestDate: Date | null = null;
      let minDistance = Infinity;
      const newValues: { [key: string]: number } = {};
      const newPercentages: { [key: string]: number } = {};

      stockSymbols.forEach((symbol) => {
        const stockData = groupedData.get(symbol) || [];
        const i = bisect(stockData, x0, 1);
        const d0 = stockData[i - 1];
        const d1 = stockData[i];
        if (d0 && d1) {
          const d = x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;
          const distance = Math.abs(d.date.getTime() - x0.getTime());
          if (distance < minDistance) {
            minDistance = distance;
            closestDate = d.date;
          }
          focus
            .select(`.circle-${symbol.replace(" ", "-")}`)
            .attr("transform", `translate(${xScale(d.date)},${yScale(d.value)})`);
          
          newValues[symbol] = d.value;
          newPercentages[symbol] = d.percentageGrowth;
        }
      });

      setCurrentValues(newValues);
      setCurrentPercentages(newPercentages);

      if (closestDate) {
        const xPos = xScale(closestDate);
        focus
          .select(".x-hover-line")
          .attr("transform", `translate(${xPos},0)`);

        // Update clipPaths
        leftClipPath.attr("width", xPos);
        rightClipPath.attr("x", xPos).attr("width", width - xPos);
      }
    }
  }, [data]);

  useEffect(() => {
    // Function to update the slider's position and width based on the active tab
    const updateSliderPosition = () => {
      if (tabRefs.current[activeTabPosition] && tabContainerRef.current) {
        const activeTab = tabRefs.current[activeTabPosition];
        const containerRect = tabContainerRef.current.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();

        // Calculate the left position relative to the container
        const left = tabRect.left - containerRect.left;
        const width = tabRect.width;

        setSliderStyle({ width, left });
      }
    };

    updateSliderPosition();

    // Update slider on window resize
    window.addEventListener("resize", updateSliderPosition);
    return () => window.removeEventListener("resize", updateSliderPosition);
  }, [activeTabPosition]);

  const handleDateRangeChange = (range: DateRange, index: number) => {
    setDateRange(range);
    setActiveTabPosition(index);
  };

  return (
    <div className="p-6 rounded-lg shadow-lg w-full max-w-6xl mx-auto bg-primary-dark">
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col my-4">
          {stockSymbols.map((symbol, index) => (
            <div key={symbol} className="flex items-center mx-4">
              <div
                className={`w-4 h-4 rounded-full mr-2`}
                style={{ backgroundColor: colors[index] }}
              ></div>
              <span className="text-xl font-bold text-gray-300">
                {symbol}: ${currentValues[symbol]?.toFixed(2) || '0.00'}
                <span className={`ml-2 ${currentPercentages[symbol] >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ({currentPercentages[symbol]?.toFixed(2) || '0.00'}%)
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="text-xl font-bold text-gray-300">
          Net deposits: $10,000.00
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
      <div
        ref={tabContainerRef}
        className="relative flex flex-row flex-nowrap py-1 px-4 rounded-3xl bg-primary justify-between items-center w-1/2 mx-auto mt-4"
      >
        <div
          className="absolute h-10 bg-secondary rounded-3xl transition-all duration-300 ease-in-out"
          style={{
            width: `${sliderStyle.width + 20}px`,
            left: `${sliderStyle.left - 10}px`,
          }}
        ></div>
        {["1D", "1W", "1M", "3M", "1Y", "ALL"].map((range, index) => (
          <div
            key={range}
            ref={(el) => {
              if (el) tabRefs.current[index] = el;
            }}
            onClick={() => handleDateRangeChange(range as DateRange, index)}
            className={`z-10 text-center px-4 py-2 rounded-3xl cursor-pointer transition-colors duration-300 ${
              dateRange === range ? "text-white" : "text-gray-400"
            }`}
          >
            {range}
          </div>
        ))}
      </div>
    </div>
  );
}