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

function MonthlyChart({ data, selectedCountries, year }) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Color palette for countries
  const colorPalette = {
    'South Korea': 'rgba(255, 99, 132, 0.8)',
    'China': 'rgba(255, 159, 64, 0.8)',
    'Taiwan': 'rgba(255, 205, 86, 0.8)',
    'Hong Kong': 'rgba(75, 192, 192, 0.8)',
    'USA': 'rgba(54, 162, 235, 0.8)',
    'Thailand': 'rgba(153, 102, 255, 0.8)'
  };

  const processChartData = () => {
    const datasets = selectedCountries.map(country => {
      const countryData = data.filter(d => d.country === country);
      const values = months.map((_, index) => {
        const monthData = countryData.find(d => d.month === index + 1);
        return monthData ? monthData.visitors : 0;
      });

      return {
        label: country,
        data: values,
        backgroundColor: colorPalette[country] || 'rgba(99, 99, 99, 0.8)',
        borderColor: colorPalette[country]?.replace('0.8', '1') || 'rgba(99, 99, 99, 1)',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false
      };
    });

    return {
      labels: months,
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
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} visitors`;
          },
          afterBody: function(tooltipItems) {
            const monthIndex = tooltipItems[0].dataIndex;
            const peakMonths = [2, 3, 4, 9, 10]; // Mar, Apr, May, Oct, Nov
            if (peakMonths.includes(monthIndex)) {
              return ['', '🌸 Peak tourism season'];
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
          text: 'Month',
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
            size: 12,
            weight: '500'
          },
          color: '#6c757d'
        }
      },
      y: {
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
          color: 'rgba(0, 0, 0, 0.1)'
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
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart'
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-placeholder">
          <div className="loading-spinner"></div>
          <p>Loading monthly data for {year}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <Bar data={processChartData()} options={options} />
      
      <div className="chart-insights">
        <div className="insight-item">
          <span className="insight-icon">🌸</span>
          <span className="insight-text">
            Peak seasons: Spring (Mar-May) for cherry blossoms and Autumn (Oct-Nov) for fall colors
          </span>
        </div>
        <div className="insight-item">
          <span className="insight-icon">❄️</span>
          <span className="insight-text">
            Lower visitor numbers in winter months (Dec-Feb) due to cold weather
          </span>
        </div>
      </div>
    </div>
  );
}

export default MonthlyChart;