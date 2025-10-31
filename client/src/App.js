import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header';
import StatsCard from './components/StatsCard';
import YearlyChart from './components/YearlyChart';
import MonthlyChart from './components/MonthlyChart';
import CovidImpactChart from './components/CovidImpactChart';
import CountrySelector from './components/CountrySelector';
import LoadingSkeleton from './components/LoadingSkeleton';
import Footer from './components/Footer';
import './App.css';

function App() {
  const [tourismData, setTourismData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [covidImpactData, setCovidImpactData] = useState([]);
  const [stats, setStats] = useState({});
  const [countries, setCountries] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState(['South Korea', 'China', 'Taiwan', 'Hong Kong', 'USA', 'Thailand']);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [yearlyRes, monthlyRes, covidRes, statsRes, countriesRes] = await Promise.all([
        axios.get('/api/tourism-data/yearly'),
        axios.get(`/api/tourism-data/monthly/${selectedYear}`),
        axios.get('/api/covid-impact'),
        axios.get('/api/stats'),
        axios.get('/api/countries')
      ]);

      setYearlyData(yearlyRes.data);
      setMonthlyData(monthlyRes.data);
      setCovidImpactData(covidRes.data);
      setStats(statsRes.data);
      setCountries(countriesRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load tourism data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch monthly data when year changes
  const fetchMonthlyData = async (year) => {
    try {
      const response = await axios.get(`/api/tourism-data/monthly/${year}`);
      setMonthlyData(response.data);
    } catch (err) {
      console.error('Error fetching monthly data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchMonthlyData(selectedYear);
    }
  }, [selectedYear]);

  // Auto-refresh data every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 600000); // 10 minutes

    return () => clearInterval(interval);
  }, []);

  const handleCountryChange = (country, checked) => {
    if (checked) {
      setSelectedCountries([...selectedCountries, country]);
    } else {
      setSelectedCountries(selectedCountries.filter(c => c !== country));
    }
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  const refreshData = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="app">
        <Header stats={stats} lastUpdated={lastUpdated} onRefresh={refreshData} />
        <main className="main-content">
          <LoadingSkeleton />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <Header stats={stats} lastUpdated={lastUpdated} onRefresh={refreshData} />
        <main className="main-content">
          <div className="error-container">
            <div className="error-card">
              <h2>🚨 Error Loading Data</h2>
              <p>{error}</p>
              <button onClick={refreshData} className="refresh-btn">
                Try Again
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header stats={stats} lastUpdated={lastUpdated} onRefresh={refreshData} />
      
      <main className="main-content">
        <div className="container">
          {/* Stats Cards */}
          <section className="stats-section">
            <StatsCard 
              title="Total Monthly Visitors"
              value={stats.totalVisitors}
              format="number"
              icon="👥"
              className="fade-in"
            />
            <StatsCard 
              title="Monthly Growth"
              value={stats.monthlyGrowth}
              format="percentage"
              icon="📈"
              className="fade-in"
              positive={stats.monthlyGrowth > 0}
            />
            <StatsCard 
              title="Top Country"
              value={stats.topCountry}
              format="text"
              icon="🏆"
              className="fade-in"
            />
          </section>

          {/* Country Selector */}
          <section className="selector-section">
            <CountrySelector 
              countries={countries}
              selectedCountries={selectedCountries}
              onCountryChange={handleCountryChange}
              selectedYear={selectedYear}
              onYearChange={handleYearChange}
            />
          </section>

          {/* Yearly Trends Chart */}
          <section className="chart-section">
            <div className="chart-card slide-in-left">
              <h2>🗾 International Visitor Arrivals (2018-2025)</h2>
              <p className="chart-subtitle">Yearly trends showing COVID-19 impact and recovery</p>
              <YearlyChart 
                data={yearlyData}
                selectedCountries={selectedCountries}
              />
            </div>
          </section>

          {/* Monthly Chart */}
          <section className="chart-section">
            <div className="chart-card slide-in-right">
              <h2>📅 Monthly Visitor Distribution ({selectedYear})</h2>
              <p className="chart-subtitle">Seasonal patterns and monthly trends</p>
              <MonthlyChart 
                data={monthlyData}
                selectedCountries={selectedCountries}
                year={selectedYear}
              />
            </div>
          </section>

          {/* COVID Impact Analysis */}
          <section className="chart-section">
            <div className="chart-card fade-in">
              <h2>🦠 COVID-19 Impact Analysis</h2>
              <p className="chart-subtitle">Recovery comparison vs pre-pandemic levels</p>
              <CovidImpactChart 
                data={covidImpactData}
                selectedCountries={selectedCountries}
              />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;