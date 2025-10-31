import React from 'react';
import { Bar } from 'react-chartjs-2';
import ChartFallback from './ChartFallback';
// ...existing imports remain

function CovidImpactChart({ data, selectedCountries }) {
  const isEmpty = !data || data.length === 0 || !selectedCountries || selectedCountries.length === 0;
  if (isEmpty) {
    return <ChartFallback title="COVID impact data not available" subtitle="Will appear after first successful ingestion." />;
  }
  // ...rest unchanged
