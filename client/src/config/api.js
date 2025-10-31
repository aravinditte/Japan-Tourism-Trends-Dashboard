// API Configuration
const API_BASE = process.env.REACT_APP_API_BASE || '';

export const API_ENDPOINTS = {
  BASE: API_BASE,
  TOURISM_DATA: `${API_BASE}/api/tourism-data`,
  TOURISM_DATA_YEARLY: `${API_BASE}/api/tourism-data/yearly`,
  TOURISM_DATA_MONTHLY: (year) => `${API_BASE}/api/tourism-data/monthly/${year}`,
  STATS: `${API_BASE}/api/stats`,
  COUNTRIES: `${API_BASE}/api/countries`,
  COVID_IMPACT: `${API_BASE}/api/covid-impact`,
  REFRESH_JNTO: `${API_BASE}/api/refresh-jnto-data`,
  DATA_SOURCES: `${API_BASE}/api/data-sources`
};

export default API_BASE;