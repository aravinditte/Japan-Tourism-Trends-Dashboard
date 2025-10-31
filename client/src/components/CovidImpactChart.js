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

function CovidImpactChart({ data, selectedCountries }) {
  const isEmpty = !data || data.length === 0 || !selectedCountries || selectedCountries.length === 0;
  if (isEmpty) {
    return <ChartFallback title="COVID impact data not available" subtitle="Will appear after first successful ingestion." />;
  }

  const filtered = data.filter(d => selectedCountries.includes(d.country));
  const countries = filtered.map(d => d.country);
  const declines = filtered.map(d => -Math.abs(d.declinePercent || 0));
  const recoveries = filtered.map(d => (d.recoveryPercent || 0) - 100);

  const chartData = {
    labels: countries,
    datasets: [
      { label: 'COVID-19 Decline (%)', data: declines, backgroundColor: 'rgba(231, 76, 60, 0.8)', borderColor: 'rgb(231, 76, 60)', borderWidth: 1, borderRadius: 3 },
      { label: '2025 Recovery vs 2019 (%)', data: recoveries, backgroundColor: 'rgba(39, 174, 96, 0.8)', borderColor: 'rgb(39, 174, 96)', borderWidth: 1, borderRadius: 3 }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { usePointStyle: true } } },
    scales: {
      x: { title: { display: true, text: 'Country' } },
      y: { title: { display: true, text: 'Percentage Change' }, ticks: { callback: (v) => `${v}%` } }
    }
  };

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export default CovidImpactChart;
