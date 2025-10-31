import React from 'react';
import './ChartFallback.css';

export default function ChartFallback({ title = 'Loading data…', subtitle = 'The service is warming up. Please wait a moment and try again.' }) {
  return (
    <div className="chart-fallback">
      <div className="chart-fallback-card">
        <div className="dot"/>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
