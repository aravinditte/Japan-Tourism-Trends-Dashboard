import React from 'react';
import './CountrySelector.css';

function CountrySelector({ countries, selectedCountries, onCountryChange, selectedYear, onYearChange }) {
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  
  const countryFlags = {
    'South Korea': '🇰🇷',
    'China': '🇨🇳',
    'Taiwan': '🇹🇼',
    'Hong Kong': '🇭🇰',
    'USA': '🇺🇸',
    'Thailand': '🇹🇭'
  };

  return (
    <div className="country-selector">
      <div className="selector-card">
        <div className="selector-content">
          <div className="countries-section">
            <h3 className="selector-title">
              🌍 Select Countries to Display
            </h3>
            <div className="countries-grid">
              {countries.map((country) => (
                <label key={country} className="country-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCountries.includes(country)}
                    onChange={(e) => onCountryChange(country, e.target.checked)}
                  />
                  <span className="checkmark">
                    <span className="check-icon">✓</span>
                  </span>
                  <span className="country-info">
                    <span className="country-flag">
                      {countryFlags[country] || '🌍'}
                    </span>
                    <span className="country-name">{country}</span>
                  </span>
                </label>
              ))}
            </div>
            
            <div className="selection-info">
              <span className="selected-count">
                {selectedCountries.length} of {countries.length} countries selected
              </span>
              <div className="quick-actions">
                <button 
                  onClick={() => {
                    countries.forEach(country => {
                      if (!selectedCountries.includes(country)) {
                        onCountryChange(country, true);
                      }
                    });
                  }}
                  className="action-btn select-all"
                  disabled={selectedCountries.length === countries.length}
                >
                  Select All
                </button>
                <button 
                  onClick={() => {
                    selectedCountries.forEach(country => {
                      onCountryChange(country, false);
                    });
                  }}
                  className="action-btn clear-all"
                  disabled={selectedCountries.length === 0}
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          <div className="year-section">
            <h3 className="selector-title">
              📅 Select Year for Monthly View
            </h3>
            <div className="year-slider-container">
              <div className="year-labels">
                {years.map((year) => (
                  <span 
                    key={year}
                    className={`year-label ${year === selectedYear ? 'active' : ''}`}
                  >
                    {year}
                  </span>
                ))}
              </div>
              <input
                type="range"
                min={Math.min(...years)}
                max={Math.max(...years)}
                step="1"
                value={selectedYear}
                onChange={(e) => onYearChange(parseInt(e.target.value))}
                className="year-slider"
              />
              <div className="year-info">
                <span className="current-year">Selected Year: <strong>{selectedYear}</strong></span>
                <div className="year-context">
                  {selectedYear <= 2019 && (
                    <span className="year-tag pre-covid">✨ Pre-COVID Era</span>
                  )}
                  {selectedYear >= 2020 && selectedYear <= 2021 && (
                    <span className="year-tag covid">🦠 COVID Impact</span>
                  )}
                  {selectedYear >= 2022 && (
                    <span className="year-tag recovery">📊 Recovery Period</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CountrySelector;