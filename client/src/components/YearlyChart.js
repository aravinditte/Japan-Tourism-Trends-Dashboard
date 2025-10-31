import React, { useEffect, useRef } from 'react';
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

  // Color palette for countries
  const colorPalette = {
    'South Korea': { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgb(255, 99, 132)' },
    'China': { bg: 'rgba(255, 159, 64, 0.2)', border: 'rgb(255, 159, 64)' },
    'Taiwan': { bg: 'rgba(255, 205, 86, 0.2)', border: 'rgb(255, 205, 86)' },
    'Hong Kong': { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgb(75, 192, 192)' },
    'USA': { bg: 'rgba(54, 162, 235, 0.2)', border: 'rgb(54, 162, 235)' },
    'Thailand': { bg: 'rgba(153, 102, 255, 0.2)', border: 'rgb(153, 102, 255)' }
  };

  // Process data for chart
  const processChartData = () => {
    const years = [...new Set(data.map(d => d.year))].sort();
    
    const datasets = selectedCountries.map(country => {
      const countryData = data.filter(d => d.country === country);
      const values = years.map(year => {
        const yearData = countryData.find(d => d.year === year);
        return yearData ? yearData.visitors : 0;
      });

      const colors = colorPalette[country] || { 
        bg: 'rgba(99, 99, 99, 0.2)', 
        border: 'rgb(99, 99, 99)' 
      };

      return {
        label: country,
        data: values,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: colors.border,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.4,
        fill: false
      };
    });

    return {
      labels: years,
      datasets
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
          pointStyle: 'circle',
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
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} visitors`;
          },
          afterBody: function(tooltipItems) {
            const year = tooltipItems[0].label;
            if (year == 2020 || year == 2021) {
              return ['', '🦠 COVID-19 Impact Period'];
            } else if (year >= 2022) {
              return ['', '📊 Recovery Period'];
            }
            return '';
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Year',
          font: {
            size: 14,
            weight: '600'
          },
          color: '#6c757d'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawOnChartArea: true,
          drawTicks: true
        },
        ticks: {
          font: {
            size: 12,
            weight: '500'
          },
          color: '#6c757d'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Number of Visitors',
          font: {
            size: 14,
            weight: '600'
          },
          color: '#6c757d'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawOnChartArea: true,
          drawTicks: true
        },
        ticks: {
          font: {
            size: 12,
            weight: '500'
          },
          color: '#6c757d',
          callback: function(value) {
            return value >= 1000000 ? 
              (value / 1000000).toFixed(1) + 'M' : 
              value >= 1000 ? 
                (value / 1000).toFixed(0) + 'K' : 
                value;
          }
        },
        beginAtZero: true
      }
    },
    elements: {
      point: {
        hoverBackgroundColor: '#fff',
        hoverBorderWidth: 3
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
          <p>Loading yearly data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <Line ref={chartRef} data={processChartData()} options={options} />
      
      <div className="chart-insights">
        <div className="insight-item">
          <span className="insight-icon">📉</span>
          <span className="insight-text">
            Dramatic decline in 2020-2021 due to COVID-19 travel restrictions
          </span>
        </div>
        <div className="insight-item">
          <span className="insight-icon">📈</span>
          <span className="insight-text">
            Strong recovery trend from 2022 onwards with some countries exceeding pre-pandemic levels
          </span>
        </div>
      </div>
    </div>
  );
}

export default YearlyChart;