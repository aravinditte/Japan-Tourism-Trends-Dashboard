import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-left">
            <h4>Japan Tourism Trends Dashboard</h4>
            <p>International Visitor Arrivals by Top Countries (2018–present)</p>
          </div>
          <div className="footer-right">
            <div className="footer-item">
              <span className="footer-label">Data Source</span>
              <span className="footer-value">JNTO & Official Reports</span>
            </div>
            <div className="footer-item">
              <span className="footer-label">Auto Refresh</span>
              <span className="footer-value">Every 6 hours (backend)</span>
            </div>
            <div className="footer-item">
              <span className="footer-label">Frontend Refresh</span>
              <span className="footer-value">Every 10 minutes</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>Built with React, Node.js, MongoDB, Chart.js</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;