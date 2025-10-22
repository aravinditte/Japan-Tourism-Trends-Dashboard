import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  GlobeAsiaAustraliaIcon,
  TrendingUpIcon,
  CalendarIcon,
  RefreshIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Components
import StatsCard from '../components/StatsCard';
import InteractiveChart from '../components/InteractiveChart';
import CountrySelector from '../components/CountrySelector';
import DateRangePicker from '../components/DateRangePicker';
import RealtimeIndicator from '../components/RealtimeIndicator';
import TrendAnalysis from '../components/TrendAnalysis';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import DataQualityIndicator from '../components/DataQualityIndicator';

// Services and Hooks
import { tourismApi } from '../services/tourismApi';
import { useSocket } from '../hooks/useSocket';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { useTheme } from '../contexts/ThemeContext';

// Types
import { TourismData, CountryData, TimeRange, RealTimeUpdate } from '../types/tourism';

// Utils
import { formatNumber, formatPercentage, formatCurrency } from '../utils/formatters';
import { calculateRecoveryRate, calculateGrowthRate } from '../utils/calculations';

interface DashboardProps {}

const Dashboard: React.FC<DashboardProps> = () => {
  // State management
  const [selectedCountry, setSelectedCountry] = useLocalStorage('selectedCountry', 'South Korea');
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: new Date('2020-01-01'),
    end: new Date()
  });
  const [realTimeData, setRealTimeData] = useState<RealTimeUpdate[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // Hooks
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const { theme } = useTheme();
  const [chartRef, isChartVisible] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px'
  });

  // Data fetching with React Query
  const {
    data: tourismData,
    isLoading: isLoadingTourism,
    error: tourismError,
    refetch: refetchTourism,
    isRefetching
  } = useQuery(
    ['tourism-data', selectedCountry, timeRange, refreshKey],
    () => tourismApi.getVisitorData({
      country: selectedCountry,
      startDate: timeRange.start.toISOString(),
      endDate: timeRange.end.toISOString(),
      period: 'monthly'
    }),
    {
      enabled: !!selectedCountry,
      refetchInterval: 5 * 60 * 1000, // 5 minutes
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      onError: (error: any) => {
        console.error('Tourism data fetch error:', error);
        toast.error(
          error?.response?.data?.error || 
          'Failed to fetch tourism data. Please try again.'
        );
      },
      onSuccess: (data) => {
        if (isManualRefresh) {
          toast.success('Data refreshed successfully!');
          setIsManualRefresh(false);
        }
      }
    }
  );

  const {
    data: countriesData,
    isLoading: isLoadingCountries,
    error: countriesError
  } = useQuery(
    ['countries-data'],
    () => tourismApi.getCountries({ sortBy: 'totalVisitors', order: 'desc' }),
    {
      staleTime: 30 * 60 * 1000, // 30 minutes
      cacheTime: 60 * 60 * 1000, // 1 hour
      onError: (error: any) => {
        console.error('Countries data fetch error:', error);
      }
    }
  );

  const {
    data: trendsData,
    isLoading: isLoadingTrends,
    error: trendsError
  } = useQuery(
    ['trends-data', timeRange],
    () => tourismApi.getTrends({ 
      timeframe: '12m',
      countries: selectedCountry 
    }),
    {
      staleTime: 15 * 60 * 1000, // 15 minutes
      enabled: !!selectedCountry,
      onError: (error: any) => {
        console.error('Trends data fetch error:', error);
      }
    }
  );

  const {
    data: recoveryData,
    isLoading: isLoadingRecovery
  } = useQuery(
    ['recovery-data'],
    () => tourismApi.getRecoveryStats({ baselineYear: 2019 }),
    {
      staleTime: 60 * 60 * 1000, // 1 hour
      onError: (error: any) => {
        console.error('Recovery data fetch error:', error);
      }
    }
  );

  // WebSocket event handlers
  useEffect(() => {
    if (socket && isConnected) {
      const handleDataUpdate = (update: RealTimeUpdate) => {
        if (!selectedCountry || update.country === selectedCountry) {
          setRealTimeData(prev => {
            const newData = [update, ...prev.slice(0, 9)];
            return newData;
          });

          // Show notification for significant updates
          if (update.type === 'update' && update.data?.visitors) {
            toast(
              `${update.country}: ${formatNumber(update.data.visitors)} visitors updated`,
              {
                icon: '📊',
                duration: 3000,
              }
            );
          }

          // Invalidate and refetch relevant queries
          queryClient.invalidateQueries(['tourism-data']);
        }
      };

      const handleUpdateSummary = (summary: any) => {
        if (summary.newCount > 0 || summary.updatedCount > 0) {
          toast.success(
            `Data updated: ${summary.newCount} new, ${summary.updatedCount} updated records`,
            { duration: 4000 }
          );
        }
      };

      const handleConnectionStatus = (status: any) => {
        if (status.status === 'connected') {
          toast.success('Connected to live data stream', { duration: 2000 });
        }
      };

      // Subscribe to updates
      socket.emit('subscribe-to-updates', { country: selectedCountry });
      socket.on('dataUpdate', handleDataUpdate);
      socket.on('updateSummary', handleUpdateSummary);
      socket.on('connection-status', handleConnectionStatus);

      // Cleanup
      return () => {
        socket.off('dataUpdate', handleDataUpdate);
        socket.off('updateSummary', handleUpdateSummary);
        socket.off('connection-status', handleConnectionStatus);
      };
    }
  }, [socket, isConnected, selectedCountry, queryClient]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    setRefreshKey(prev => prev + 1);
    
    try {
      await Promise.all([
        queryClient.invalidateQueries(['tourism-data']),
        queryClient.invalidateQueries(['countries-data']),
        queryClient.invalidateQueries(['trends-data']),
        queryClient.invalidateQueries(['recovery-data'])
      ]);
    } catch (error) {
      console.error('Manual refresh error:', error);
      toast.error('Failed to refresh data');
      setIsManualRefresh(false);
    }
  }, [queryClient]);

  // Computed values
  const currentCountryData = useMemo(() => {
    if (!tourismData?.data || !selectedCountry) return null;
    return tourismData.data.find((item: CountryData) => 
      item.country.toLowerCase() === selectedCountry.toLowerCase()
    );
  }, [tourismData, selectedCountry]);

  const recoveryRate = useMemo(() => {
    if (!recoveryData?.data || !selectedCountry) return 0;
    const countryRecovery = recoveryData.data.find(
      (item: any) => item.country.toLowerCase() === selectedCountry.toLowerCase()
    );
    return countryRecovery?.recoveryRate || 0;
  }, [recoveryData, selectedCountry]);

  const totalVisitors = useMemo(() => {
    if (!countriesData?.data) return 0;
    return countriesData.data.reduce((sum: number, country: CountryData) => 
      sum + (country.totalVisitors || 0), 0
    );
  }, [countriesData]);

  const growthRate = useMemo(() => {
    if (!trendsData?.data || trendsData.data.length === 0) return 0;
    const countryTrend = trendsData.data.find(
      (item: any) => item._id.toLowerCase() === selectedCountry.toLowerCase()
    );
    return countryTrend?.growthRate || 0;
  }, [trendsData, selectedCountry]);

  // Loading state
  const isLoading = isLoadingTourism || isLoadingCountries || isLoadingTrends || isLoadingRecovery;

  // Error state
  const hasError = tourismError || countriesError || trendsError;

  if (isLoading && !tourismData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" message="Loading dashboard data..." />
      </div>
    );
  }

  if (hasError && !tourismData) {
    return (
      <ErrorMessage 
        title="Failed to load dashboard data"
        message="There was an error loading the tourism data. Please check your connection and try again."
        onRetry={handleManualRefresh}
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>{selectedCountry} - Japan Tourism Dashboard</title>
        <meta 
          name="description" 
          content={`Real-time tourism analytics for ${selectedCountry} visitors to Japan. View trends, recovery rates, and live data updates.`} 
        />
      </Helmet>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6 sm:space-y-8"
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <motion.h1 
              className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              🇯🇵 Japan Tourism Dashboard
            </motion.h1>
            <motion.p 
              className="text-base sm:text-lg text-gray-600 dark:text-gray-300"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              Real-time insights into international visitor trends
            </motion.p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <RealtimeIndicator 
              isConnected={isConnected} 
              lastUpdate={realTimeData[0]?.timestamp}
            />
            <motion.button 
              onClick={handleManualRefresh}
              disabled={isRefetching || isManualRefresh}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RefreshIcon className={`w-5 h-5 mr-2 ${(isRefetching || isManualRefresh) ? 'animate-spin' : ''}`} />
              {isRefetching || isManualRefresh ? 'Refreshing...' : 'Refresh'}
            </motion.button>
          </div>
        </div>

        {/* Controls */}
        <motion.div 
          className="flex flex-col xl:flex-row xl:items-center xl:space-x-6 space-y-4 xl:space-y-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex-1">
            <CountrySelector
              countries={countriesData?.data || []}
              selectedCountry={selectedCountry}
              onCountryChange={(country) => {
                setSelectedCountry(country);
                setRealTimeData([]); // Clear real-time data when switching countries
              }}
              isLoading={isLoadingCountries}
            />
          </div>
          
          <div className="flex-1">
            <DateRangePicker
              startDate={timeRange.start}
              endDate={timeRange.end}
              onChange={setTimeRange}
              maxDate={new Date()}
              minDate={new Date('2018-01-01')}
            />
          </div>
        </motion.div>

        {/* Data Quality Indicator */}
        {tourismData?.data && (
          <DataQualityIndicator 
            dataSource={tourismData.cached ? 'cache' : 'live'}
            lastUpdate={tourismData.lastUpdate}
            recordCount={tourismData.count}
          />
        )}

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatsCard
            title="Current Month Visitors"
            value={currentCountryData?.latestVisitors || 0}
            change={growthRate}
            icon={GlobeAsiaAustraliaIcon}
            trend={growthRate >= 0 ? "up" : "down"}
            format="number"
            isLoading={isLoadingTourism}
            subtitle={`${selectedCountry}`}
          />
          
          <StatsCard
            title="Total Visitors (All Time)"
            value={totalVisitors}
            change={8.3}
            icon={ChartBarIcon}
            trend="up"
            format="number"
            isLoading={isLoadingCountries}
            subtitle="All countries combined"
          />
          
          <StatsCard
            title="Recovery Rate vs 2019"
            value={recoveryRate}
            change={5.2}
            icon={TrendingUpIcon}
            trend={recoveryRate >= 100 ? "up" : "neutral"}
            format="percentage"
            isLoading={isLoadingRecovery}
            subtitle={recoveryRate >= 100 ? "Exceeded baseline" : "Partial recovery"}
          />
          
          <StatsCard
            title="Real-time Updates"
            value={realTimeData.length}
            change={0}
            icon={CalendarIcon}
            trend="neutral"
            format="number"
            subtitle={isConnected ? "Live connection" : "Offline"}
          />
        </motion.div>

        {/* Main Chart */}
        <motion.div 
          ref={chartRef}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                Visitor Trends - {selectedCountry}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {timeRange.start.toLocaleDateString()} - {timeRange.end.toLocaleDateString()}
              </p>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              {tourismData?.cached && (
                <div className="flex items-center space-x-1">
                  <InformationCircleIcon className="w-4 h-4" />
                  <span>Cached data</span>
                </div>
              )}
              <div>
                Last updated: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
          
          {isChartVisible && (
            <InteractiveChart
              data={tourismData?.data || []}
              selectedCountry={selectedCountry}
              timeRange={timeRange}
              realTimeUpdates={realTimeData}
              isLoading={isLoadingTourism}
              theme={theme}
            />
          )}
        </motion.div>

        {/* Analytics and Real-time Updates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <TrendAnalysis
              data={trendsData?.data || []}
              selectedCountry={selectedCountry}
              title="Growth Patterns & Insights"
              isLoading={isLoadingTrends}
              recoveryData={recoveryData?.data}
            />
          </motion.div>
          
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Live Data Feed
              </h3>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <AnimatePresence>
                {realTimeData.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">
                      {isConnected ? 'Waiting for live updates...' : 'Connection offline'}
                    </div>
                    {!isConnected && (
                      <div className="flex items-center justify-center mt-2 text-amber-600 dark:text-amber-400">
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                        <span className="text-sm">Real-time features unavailable</span>
                      </div>
                    )}
                  </div>
                ) : (
                  realTimeData.map((update, index) => (
                    <motion.div
                      key={`${update.country}-${update.timestamp}-${index}`}
                      initial={{ opacity: 0, x: 20, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          update.type === 'new' ? 'bg-green-500' :
                          update.type === 'update' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {update.country}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {update.type} • {new Date(update.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatNumber(update.data?.visitors || 0)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          visitors
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
};

export default Dashboard;