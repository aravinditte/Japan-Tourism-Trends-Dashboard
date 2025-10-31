import React from 'react';
import { Bar } from 'react-chartjs-2';
import ChartFallback from './ChartFallback';
// ...existing imports remain

function MonthlyChart({ data, selectedCountries, year }) {
  const isEmpty = !data || data.length === 0 || !selectedCountries || selectedCountries.length === 0;
  if (isEmpty) {
    return <ChartFallback title={`Monthly data for ${year} not available`} subtitle="Service warming up or no records yet." />;
  }
  // ...rest unchanged
