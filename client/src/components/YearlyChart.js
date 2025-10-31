import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ChartFallback from './ChartFallback';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function YearlyChart({ data, selectedCountries }) {
  const chartRef = useRef();

  const isEmpty = !data || data.length === 0 || !selectedCountries || selectedCountries.length === 0;
  if (isEmpty) {
    return <ChartFallback title="Yearly data not available yet" subtitle="Fetching latest JNTO updates…" />;
  }

  const colorPalette = {
    'South Korea': { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgb(255, 99, 132)' },
    'China': { bg: 'rgba(255, 159, 64, 0.2)', border: 'rgb(255, 159, 64)' },
    'Taiwan': { bg: 'rgba(255, 205, 86, 0.2)', border: 'rgb(255, 205, 86)' },
    'Hong Kong': { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgb(75, 192, 192)' },
    'USA': { bg: 'rgba(54, 162, 235, 0.2)', border: 'rgb(54, 162, 235)' },
    'Thailand': { bg: 'rgba(153, 102, 255, 0.2)', border: 'rgb(153, 102, 255)' }
  };

  const years = [...new Set(data.map(d => d.year))].sort();
  const datasets = selectedCountries.map(country => {
    const countryData = data.filter(d => d.country === country);
    const values = years.map(year => {
      const yearData = countryData.find(d => d.year === year);
      return yearData ? yearData.visitors : 0;
    });
    const colors = colorPalette[country] || { bg: 'rgba(99,99,99,0.2)', border: 'rgb(99,99,99)' };
    return {
      label: country,
      data: values,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.35,
      fill: false
    };
  });

  const chartData = { labels: years, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true } },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} visitors`,
          afterBody: (items) => {
            const year = items[0].label;
            if (Number(year) === 2020 || Number(year) === 2021) return ['', 'COVID-19 Impact Period'];
            if (Number(year) >= 2022) return ['', 'Recovery Period'];
            return '';
          }
        }
      }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: { title: { display: true, text: 'Year' } },
      y: {
        title: { display: true, text: 'Number of Visitors' },
        beginAtZero: true,
        ticks: {
          callback: (v) => v >= 1_000_000 ? (v/1_000_000).toFixed(1)+'M' : v >= 1_000 ? (v/1_000).toFixed(0)+'K' : v
        }
      }
    }
  };

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

export default YearlyChart;
