import React from 'react';
import CountUp from 'react-countup';
import './StatsCard.css';

function StatsCard({ title, value, format = 'number', icon, className = '', positive = null }) {
  const formatValue = (val) => {
    if (format === 'number') {
      return (
        <CountUp 
          end={val || 0} 
          duration={2.5} 
          separator="," 
          preserveValue
        />
      );
    }
    
    if (format === 'percentage') {
      return (
        <span className={positive !== null ? (positive ? 'positive' : 'negative') : ''}>
          {val >= 0 ? '+' : ''}
          <CountUp 
            end={val || 0} 
            duration={2.5} 
            decimals={1}
            preserveValue
          />%
        </span>
      );
    }
    
    return val || 'N/A';
  };

  return (
    <div className={`stats-card ${className}`}>
      <div className="stats-card-content">
        <div className="stats-header">
          <div className="stats-icon">{icon}</div>
          <h3 className="stats-title">{title}</h3>
        </div>
        
        <div className="stats-value">
          {formatValue(value)}
        </div>
        
        {format === 'percentage' && (
          <div className="stats-trend">
            <span className={`trend-indicator ${positive ? 'up' : 'down'}`}>
              {positive ? '↑' : '↓'}
            </span>
            <span className="trend-text">
              {positive ? 'Increasing' : 'Decreasing'} vs last month
            </span>
          </div>
        )}
        
        {format === 'number' && (
          <div className="stats-description">
            Current month visitors
          </div>
        )}
        
        {format === 'text' && (
          <div className="stats-description">
            Leading source market
          </div>
        )}
      </div>
      
      <div className="stats-card-glow"></div>
    </div>
  );
}

export default StatsCard;