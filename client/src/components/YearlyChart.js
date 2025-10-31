import React from 'react';
import { Line } from 'react-chartjs-2';
import ChartFallback from './ChartFallback';
// ...existing imports remain

// keep previous registrations

function YearlyChart({ data, selectedCountries }) {
  // guard empty
  const isEmpty = !data || data.length === 0 || !selectedCountries || selectedCountries.length === 0;
  if (isEmpty) {
    return <ChartFallback title="Yearly data not available yet" subtitle="Fetching latest JNTO updates…" />;
  }
  // ...rest of existing component code below unchanged
