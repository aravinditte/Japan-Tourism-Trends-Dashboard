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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function CovidImpactChart({ data, selectedCountries }) {
  const processChartData = () => {
    const filteredData = data.filter(d => selectedCountries.includes(d.country));
    
    const countries = filteredData.map(d => d.country);
    const declines = filteredData.map(d => -d.declinePercent); // Negative for decline
    const recoveries = filteredData.map(d => d.recoveryPercent - 100); // Relative to 100%

    return {
      labels: countries,
      datasets: [
        {
          label: 'COVID-19 Decline (%)',
          data: declines,
          backgroundColor: 'rgba(231, 76, 60, 0.8)',
          borderColor: 'rgb(231, 76, 60)',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: '2025 Recovery vs 2019 (%)',
          data: recoveries,
          backgroundColor: 'rgba(39, 174, 96, 0.8)',
          borderColor: 'rgb(39, 174, 96)',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'rect',
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#2c3e50',
        bodyColor: '#2c3e50',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context) {
            const value = Math.abs(context.parsed.y);
            const isDecline = context.datasetIndex === 0;
            const suffix = isDecline ? '% decline' : '% vs 2019';
            return `${context.dataset.label}: ${value.toFixed(1)}${suffix}`;
          },
          afterBody: function(tooltipItems) {
            const countryName = tooltipItems[0].label;
            const countryData = data.find(d => d.country === countryName);
            if (countryData) {
              return [
                '',
                `Pre-COVID (2019): ${countryData.preCovid2019.toLocaleString()}`,
                `COVID Low: ${countryData.covidLow.toLocaleString()}`,
                `2025 Recovery: ${countryData.recovery2025.toLocaleString()}`
              ];
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Country',
          font: {
            size: 14,
            weight: '600'
          },
          color: '#6c757d'
        },
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11,
            weight: '500'
          },
          color: '#6c757d',
          maxRotation: 45
        }
      },
      y: {
        title: {
          display: true,
          text: 'Percentage Change',
          font: {
            size: 14,
            weight: '600'
          },
          color: '#6c757d'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          font: {
            size: 12,
            weight: '500'
          },
          color: '#6c757d',
          callback: function(value) {
            return value + '%';
          }
        }
      }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart'
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-placeholder">
          <div className="loading-spinner"></div>
          <p>Loading COVID impact analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <Bar data={processChartData()} options={options} />
      
      <div className="chart-insights">
        <div className="insight-item">
          <span className="insight-icon">🦠</span>
          <span className="insight-text">
            All countries experienced 80-99% decline in visitor arrivals during 2020-2021
          </span>
        </div>
        <div className="insight-item">
          <span className="insight-icon">📈</span>
          <span className="insight-text">
            Some countries like South Korea and USA have exceeded pre-pandemic levels by 2025
          </span>
        </div>
        <div className="insight-item">
          <span className="insight-icon">🇨🇳</span>
          <span className="insight-text">
            China's recovery remains slower, likely due to ongoing travel policy changes
          </span>
        </div>
      </div>
    </div>
  );
}

export default CovidImpactChart;