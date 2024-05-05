import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import { csv, json, scaleLinear, scaleTime, scaleSequential, interpolateViridis, axisBottom, axisLeft, line, select, timeFormat, geoPath, geoMercator } from 'd3';

import { Row, Col, Container } from 'react-bootstrap';
import styles from '../styles/main.module.css';

const csvUrl = 'https://raw.githubusercontent.com/JenniferYao22/HDI-dataset/main/Human%20Development%20Index%20-%20Full.csv';
const mapUrl = 'https://gist.githubusercontent.com/hogwild/26558c07f9e4e89306f864412fbdba1d/raw/5458902712c01c79f36dc28db33e345ee71487eb/countries.geo.json';

function useData(csvPath) {
    const [data, setData] = useState(null);
    useEffect(() => {
        csv(csvPath).then(data => {
            const mappedData = new Map();
            data.forEach(d => {
                const countryData = {
                    HDI: {},
                    GNI: {},
                    LEB: {},
                    EYS: {},
                    countryName: d.Country 
                };
                Object.keys(d).forEach(key => {
                    if (key.includes('Human Development Index')) {
                        countryData.HDI[key.match(/\((\d{4})\)/)[1]] = +d[key];
                    } else if (key.includes('Gross National Income Per Capita')) {
                        countryData.GNI[key.match(/\((\d{4})\)/)[1]] = +d[key];
                    } else if (key.includes('Life Expectancy at Birth')) {
                        countryData.LEB[key.match(/\((\d{4})\)/)[1]] = +d[key];
                    } else if (key.includes('Expected Years of Schooling')) {
                        countryData.EYS[key.match(/\((\d{4})\)/)[1]] = +d[key];
                    }
                });
                mappedData.set(d.ISO3, countryData);
            });
            setData(mappedData);
        });
    }, [csvPath]);
    return data;
}

function useMap(jsonPath) {
    const [data, setData] = useState(null);
    useEffect(() => {
        json(jsonPath).then(setData);
    }, [jsonPath]);
    return data;
}

const LineChart = ({ data, selectedCountry }) => {
    const svgRef = useRef();
    useEffect(() => {
        if (!data) return;
        const svg = select(svgRef.current);
        console.log(data)
        svg.selectAll('*').remove();

        const width = 500;
        const height = 250;
        const margin = { top: 20, right: 30, bottom: 30, left: 60 };
        const xScale = scaleTime().domain([new Date(1990, 0, 1), new Date(2021, 0, 1)]).range([margin.left, width - margin.right]);
        const yScale = scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
        const colorScale = scaleLinear()
            .domain([0.3, 0.5, 0.6, 0.7, 0.85])
            .range(["#bd1d1a", "#fb8c00", "#fdd835", "#12750e", "#1d1ac9"]); 
        const lineGenerator = line().defined(d => d.value !== 0).x(d => xScale(new Date(d.year, 0, 1))).y(d => yScale(d.value));
        svg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height - margin.bottom})`).call(axisBottom(xScale).ticks(5).tickFormat(timeFormat("%Y")));
        svg.append("text").attr("text-anchor", "end").attr("x", width - margin.right).attr("y", height - margin.bottom + 30).text("Year").style("font-size", "12px");
        svg.append("text").attr("text-anchor", "end").attr("transform", "rotate(-90)").attr("y", margin.left - 30).attr("x", -margin.top).text("Human Development Index Level").style("font-size", "12px");
        svg.append("g").attr("class", "y-axis").attr("transform", `translate(${margin.left},0)`).call(axisLeft(yScale));

        const isoLabel = svg.append("text")
            .style("font-size", "10px")
            .attr("fill", "black")
            .style("opacity", 0);

        const lines = svg.selectAll(".line")
            .data(data, d => d.ISO3)
            .join("path")
            .attr("class", "line")
            .attr("stroke", d => colorScale(d.values.find(v => v.year === 2021)?.value))
            .attr("fill", "none")
            .attr("stroke-width", d => d.ISO3 === selectedCountry ? 2 : 0.5)
            .attr("d", d => lineGenerator(d.values))
            .attr("opacity", d => d.ISO3 === selectedCountry ? 1 : 0.2)
            .on("mouseover", (event, d) => {
                select(event.currentTarget).attr("stroke-width", 2).attr("opacity", 1);
                isoLabel.attr("x", event.pageX - svgRef.current.getBoundingClientRect().left +10)
                    .attr("y", event.pageY - svgRef.current.getBoundingClientRect().top+10 )
                    .text(d.countryName)
                    .style("font-size", "14px")
                    .style("font-weight", "bold")
                    .style("opacity", 1);
            })
            .on("mouseout", (event, d) => {
                select(event.currentTarget).attr("stroke-width", d.ISO3 === selectedCountry ? 2 : 0.5).attr("opacity", d => d.ISO3 === selectedCountry ? 1 : 0.2);
                isoLabel.style("opacity", 0);
            });

        if (selectedCountry) {
            const selectedData = data.find(d => d.ISO3 === selectedCountry);
            if (selectedData && selectedData.values.length > 0) {
                const lastPoint = selectedData.values[selectedData.values.length - 1];
                svg.append("text")
                    .attr("x", xScale(new Date(lastPoint.year, 0, 1)) + 5)
                    .attr("y", yScale(lastPoint.value))
                    .attr("fill", "black")
                    .style("font-size", "11px")
                    .style("font-weight", "bold")
                    .text(selectedCountry);
            }
        }
    }, [data, selectedCountry]);

    return <svg ref={svgRef} width={500} height={250}><g className="x-axis" /><g className="y-axis" /></svg>;
};

const ScatterPlot = ({ data, year, selectedCountry, onCountrySelect }) => {
    const svgRef = useRef();
    useEffect(() => {
        if (!data) return;
        const svg = select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 500;
        const height = 250;
        const margin = { top: 20, right: 20, bottom: 40, left: 60 };
        const yearData = Array.from(data).map(([iso, { HDI, GNI,countryName }]) => ({ x: GNI[year], y: HDI[year], iso ,countryName})).filter(d => d.x && d.y);
        const xScale = scaleLinear().domain([0, Math.max(...yearData.map(d => d.x))]).range([margin.left, width - margin.right]);
        const yScale = scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);

        svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height - margin.bottom})`).call(axisBottom(xScale));
        svg.append('g').attr('class', 'y-axis').attr('transform', `translate(${margin.left},0)`).call(axisLeft(yScale));
        svg.append("text").attr("text-anchor", "end").attr("x", width - margin.right).attr("y", height - 10).text("Gross National Income Per Capita").style("font-size", "12px");
        svg.append("text").attr("text-anchor", "end").attr("transform", "rotate(-90)").attr("y", margin.left - 30).attr("x", -margin.top).text("Human Development Index Level").style("font-size", "12px");

        const isoLabel = svg.append("text")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .attr("fill", "black")
            .style("opacity", 0);

        const dots = svg.selectAll('.dot')
            .data(yearData)
            .join('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 3)
            .attr('fill', d => d.iso === selectedCountry ? 'red' : 'grey')
            .on("click", d => onCountrySelect(d.iso))
            .on('mouseover', function (event, d) {


    // Calculate adjusted positions for the label
    const xPosition = xScale(d.x);
    const yPosition = yScale(d.y) - 10;
    const labelWidth = 100; // Estimate or calculate the width of your label
    const labelHeight = 20; // Estimate or calculate the height of your label

    // Adjust label positions to prevent clipping at edges
    const adjustedX = xPosition + labelWidth + 5 > width ? xPosition - labelWidth - 5 : xPosition -15;
    const adjustedY = yPosition - labelHeight < 0 ? yPosition + 5 : yPosition - 5;

                select(this)
                    .raise()
                    .transition()
                    .duration(150)
                    .attr('r', 4)
                    .attr('stroke', 'red')
                    .attr('fill', 'red')
                    .attr('stroke-width', 2);
               
    isoLabel.raise()
    .attr("x", adjustedX)
    .attr("y", adjustedY)
    .text(d.countryName)
    .style("opacity", 1)
    .style("font-size", "14px")
    .style("font-weight", "bold");

            })
            .on('mouseout', function (event, d) {
                select(this)
                    .transition()
                    .duration(150)
                    .attr('r', 3)
                    .attr('stroke', 'none')
                    .attr('fill', d.iso === selectedCountry ? 'red' : 'grey')
                    .attr('stroke-width', 0);
                isoLabel.style("opacity", 0);
            });

        if (selectedCountry) {
            const selectedData = yearData.find(d => d.iso === selectedCountry);
            if (selectedData) {
                svg.append('circle')
                    .attr('cx', xScale(selectedData.x))
                    .attr('cy', yScale(selectedData.y))
                    .attr('r', 4)
                    .attr('fill', 'red')
                    .attr('stroke', 'red')
                    .attr('stroke-width', 2);
                svg.append("text")
                    .attr('x', xScale(selectedData.x) + 5)
                    .attr('y', yScale(selectedData.y) + 4)
                    .text(selectedCountry)
                    .style("opacity", 1)
                    .style("font-size", "14px")
                    .style("font-weight", "bold");

            }
        }
    }, [data, year, selectedCountry, onCountrySelect]);

    return <svg ref={svgRef} width={500} height={250}><g className="x-axis" /><g className="y-axis" /></svg>;
};

const ColorLegend = ({ colorScale, width = 300, height = 20, title = "HDI Value Level" }) => {
    return (
        <svg width={width} height={height + 100}> {/* Ensure adequate space for elements */}

            <defs>

                <linearGradient id="gradient-color-legend">
                    {colorScale.ticks(10).map((t, i, arr) => (
                        <stop
                            key={i}
                            offset={`${(i / arr.length) * 100}%`}
                            stopColor={colorScale(t)}
                        />
                    ))}
                </linearGradient>
            </defs>
            {/* Center the title and adjust y position to be more visually appropriate.*/}
            <text x={width / 2} y={10} style={{ textAnchor: 'middle', fontSize: '12px', fontWeight: 'bold' }}>
                {title}
            </text>
            <text x={0} y={22} style={{ textAnchor: 'start', fontSize: '10px', fontWeight: 'bold' }}>
                low
            </text>
            <text x={218} y={22} style={{ textAnchor: 'end', fontSize: '10px', fontWeight: 'bold' }}>
                high
            </text>

            {/* Place the rectangle without negative x, adjust y to be just under the title */}
            <rect x={0} y={25} width={width} height={height} fill="url(#gradient-color-legend)" />
            {/* Adjust the positioning of the percentage texts */}
            <text x={0} y={height + 45} style={{ fontSize: '10px' }}> {/* Raise slightly for better alignment */}
                {`${(colorScale.domain()[0] * 100).toFixed(2)}%`}
            </text>
            <text x={width - 5} y={height + 45} style={{ textAnchor: 'end', fontSize: '10px' }}> {/* Slight offset for end alignment */}
                {`${(colorScale.domain()[1] * 100).toFixed(2)}%`}
            </text>
        </svg>
    );
};

const HDI = () => {
    const hdiData = useData(csvUrl);
    const geoData = useMap(mapUrl);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [year, setYear] = useState("2021");
    const [countryInfo, setCountryInfo] = useState({ name: "", HDI: null });
    const [notePosition, setNotePosition] = useState({ x: 0, y: 0 });
    const svgWidth = 750; 
    const svgHeight = 547;
    const legendTransformX = svgWidth - 220; // Adjust to fit within the SVG bounds
    const legendTransformY = svgHeight - 40; // Place it at the bottom


    const handleCountryClick = (countryISO, event) => {
        if (selectedCountry === countryISO) {
            setSelectedCountry(null);
            setCountryInfo({});
            return;
        }

        const { clientX, clientY } = event;
        setSelectedCountry(countryISO);
        const countryData = hdiData.get(countryISO);
        const countryName = geoData.features.find(f => f.id === countryISO)?.properties.name;
        const countryHDI = countryData ? countryData.HDI[year] : 'N/A';
        const countryGNI = countryData ? countryData.GNI[year] : 'N/A';
        const countryLEB = countryData ? countryData.LEB[year] : 'N/A';
        const countryEYS = countryData ? countryData.EYS[year] : 'N/A';

        setCountryInfo({
            name: countryName, HDI: countryHDI, GNI: countryGNI, LEB: countryLEB, EYS: countryEYS
        });
        setNotePosition({ x: clientX, y: clientY });
    };

    const updateCountryInfo = (countryISO, selectedYear) => {
        const countryData = hdiData.get(countryISO);
        const countryName = geoData.features.find(f => f.id === countryISO)?.properties.name;
        const countryHDI = countryData ? countryData.HDI[selectedYear].toFixed(2) : 'N/A';
        const countryGNI = countryData ? Number(countryData.GNI[selectedYear]).toFixed(2) : 'N/A';
        const countryLEB = countryData ? Number(countryData.LEB[selectedYear]).toFixed(2) : 'N/A';
        const countryEYS = countryData ? Number(countryData.EYS[selectedYear]).toFixed(2) : 'N/A';

        setCountryInfo({
            name: countryName,
            HDI: `${countryHDI}`,
            GNI: `${countryGNI}`,
            LEB: `${countryLEB}`,
            EYS: `${countryEYS}`
        });
    };


    const handleSliderChange = (e) => {
        const newYear = e.target.value;
        setYear(newYear);
        if (selectedCountry) updateCountryInfo(selectedCountry, newYear);
    };

    if (!geoData || !hdiData) {
        return <div>Loading...</div>;
    }

    const chartData = Array.from(hdiData, ([ISO3, countryData]) => ({
        ISO3,
        values: Object.keys(countryData.HDI).map(year => ({ year: parseInt(year), value: countryData.HDI[year] })).sort((a, b) => a.year - b.year),
        countryName: countryData.countryName 
    }));

    const projection = geoMercator().scale(150).translate([750 / 2, 547 / 2 + 50]);
    const pathGenerator = geoPath().projection(projection);

    const colorScale = scaleLinear()
        .domain([0.3, 0.5, 0.6, 0.7, 0.85,1])
        .range(["#bd1d1a", "#fb8c00", "#fdd835", "#12750e", "#1d1ac9","#3457D5"]); 


    return (
        <Container>

            <Row>
                <Col lg={12}>
                    <h1 className={styles.h1Style}>Human Development Index (HDI)</h1>
                </Col>
            </Row>
            <Row>
                <Col lg={12}>
                    <body className={styles.introStyle}>
                        Welcome to our interactive dashboard on the Human Development Index (HDI). It is an composite index published by United Nation Human Development Program as a summary measure of average achievement in key dimensions of human development: a long and healthy life, being knowledgeable and having a decent standard of living.
                        Here, you can explore various metrics like Gross National Income, Life Expectancy, and Educational Attainment across countries to better understand global development trends. Dive into the data with our visual tools and detailed analyses.
                    </body>
                </Col>
            </Row>
            <p></p >
            <Row>
                <Col lg={7}>
                    <h2 className={styles.titleStyle}>Human Development Index (HDI) by Country</h2>
                    <svg width={svgWidth} height={svgHeight}>
                        {geoData.features.map((feature, idx) => (
                            <path key={idx} d={pathGenerator(feature)}
                                fill={hdiData.has(feature.id) && hdiData.get(feature.id).HDI[year] ? colorScale(hdiData.get(feature.id).HDI[year]) : '#ccc'}
                                stroke="#000"
                                onClick={(event) => handleCountryClick(feature.id, event)} />
                        ))}
                        
                        <g transform={`translate(${legendTransformX}, ${legendTransformY})`}>
                            <ColorLegend colorScale={colorScale} />
                        </g>
                    </svg>

                    {selectedCountry && countryInfo.name && (
                        <div className="alert alert-info mt-3"
                            style={{
                                position: 'absolute', left: `${notePosition.x}px`, top: `${notePosition.y}px`,
                                maxWidth: '300px', fontSize: '10px'
                            }}>
                            <strong>{countryInfo.name}</strong><br />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Human Development Index:</span>
                                <span style={{ marginLeft: '10px' }}>{Number(countryInfo.HDI).toFixed(3)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Gross National Income Per Capita:</span>
                                <span style={{ marginLeft: '10px' }}>{Number(countryInfo.GNI).toFixed(0)}$</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Life Expectancy at Birth:</span>
                                <span style={{ marginLeft: '10px' }}>{Number(countryInfo.LEB).toFixed(1)} years</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Expected Year of Schooling:</span>
                                <span style={{ marginLeft: '10px' }}>{Number(countryInfo.EYS).toFixed(1)} years</span>
                            </div>
                        </div>
                    )}


                    <div>
                        Year: {year} <input type="range" min="1990" max="2021" value={year}
                            onChange={handleSliderChange}
                            className="slider" id="yearRangeSlider" />
                    </div>
                </Col>
                <Col lg={5}>
                    <Row>
                        <Col lg={12}>
                            <h2 className={styles.titleStyle}>Trend of HDI Over Time</h2>
                            <LineChart data={chartData} selectedCountry={selectedCountry} />
                        </Col>
                    </Row>
                    <p></p >
                    <Row>
                        <Col lg={12}>
                            <h2 className={styles.titleStyle} >Relationship Between Gross National Income Per Capita and HDI</h2>
                            <ScatterPlot data={hdiData} year={year} selectedCountry={selectedCountry} onCountrySelect={handleCountryClick} />
                        </Col>
                    </Row>
                    <Row><p></p ></Row>
                </Col>
            </Row>
        </Container>
    );
};

export default HDI;