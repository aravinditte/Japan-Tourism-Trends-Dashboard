import React from 'react';
import './LoadingSkeleton.css';

function LoadingSkeleton() {
  return (
    <div className="loading-skeleton">
      <div className="skeleton-header"></div>
      <div className="skeleton-stats">
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
      </div>
      <div className="skeleton-chart"></div>
      <div className="skeleton-chart"></div>
    </div>
  );
}

export default LoadingSkeleton;