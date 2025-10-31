import React from 'react';
import CountUp from 'react-countup';
import './Header.css';

function Header({ stats, lastUpdated, onRefresh }) {
  const formatTime = (date) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(new Date(date));
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              🗾 Japan Tourism Trends Dashboard
            </h1>
            <p className="header-subtitle">
              International Visitor Arrivals • COVID-19 Impact Analysis • JNTO Data
            </p>
            <div className="header-stats-mini">
              <div className="mini-stat">
                <span className="mini-stat-label">Current Visitors:</span>
                <span className="mini-stat-value">
                  <CountUp 
                    end={stats.totalVisitors || 0} 
                    duration={2} 
                    separator="," 
                  />
                </span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-label">Growth:</span>
                <span className={`mini-stat-value ${stats.monthlyGrowth >= 0 ? 'positive' : 'negative'}`}>
                  {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth || 0}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="header-right">
            <div className="header-actions">
              <button 
                onClick={onRefresh} 
                className="refresh-button"
                aria-label="Refresh data"
              >
                <span className="refresh-icon">🔄</span>
                Refresh
              </button>
              <div className="last-updated">
                <span className="update-label">Last Updated:</span>
                <span className="update-time">{formatTime(lastUpdated)}</span>
              </div>
            </div>
            <div className="data-source">
              <span className="source-label">Data Source:</span>
              <span className="source-name">JNTO (Japan National Tourism Organization)</span>
            </div>
          </div>
        </div>
        
        <div className="header-indicator">
          <div className="live-indicator">
            <div className="live-dot pulse"></div>
            <span>Live Data</span>
          </div>
          <div className="auto-refresh-info">
            Auto-refresh every 10 minutes
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;