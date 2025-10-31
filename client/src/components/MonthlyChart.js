import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartFallback from './ChartFallback';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function MonthlyChart({ data, selectedCountries, year }) {
  const isEmpty = !data || data.length === 0 || !selectedCountries || selectedCountries.length === 0;
  if (isEmpty) {
    return <ChartFallback title={`Monthly data for ${year} not available`} subtitle="Service warming up or no records yet." />;
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const colorPalette = {
    'South Korea': 'rgba(255, 99, 132, 0.8)',
    'China': 'rgba(255, 159, 64, 0.8)',
    'Taiwan': 'rgba(255, 205, 86, 0.8)',
    'Hong Kong': 'rgba(75, 192, 192, 0.8)',
    'USA': 'rgba(54, 162, 235, 0.8)',
    'Thailand': 'rgba(153, 102, 255, 0.8)'
  };

  const datasets = selectedCountries.map(country => {
    const countryData = data.filter(d => d.country === country);
    const values = months.map((_, idx) => {
      const md = countryData.find(d => d.month === idx + 1);
      return md ? md.visitors : 0;
    });
    const color = colorPalette[country] || 'rgba(99,99,99,0.8)';
    return { label: country, data: values, backgroundColor: color, borderColor: color.replace('0.8','1'), borderWidth: 1, borderRadius: 3, borderSkipped: false };
  });

  const chartData = { labels: months, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { usePointStyle: true } } },
    scales: {
      x: { title: { display: true, text: 'Month' } },
      y: {
        title: { display: true, text: 'Number of Visitors' },
        beginAtZero: true,
        ticks: { callback: (v) => v >= 1_000_000 ? (v/1_000_000).toFixed(1)+'M' : v >= 1_000 ? (v/1_000).toFixed(0)+'K' : v }
      }
    }
  };

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export default MonthlyChart;
