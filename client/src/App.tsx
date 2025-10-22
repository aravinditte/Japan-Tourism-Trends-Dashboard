import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorFallback from './components/ErrorFallback';
import NotFound from './components/NotFound';

// Pages
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Countries from './pages/Countries';
import RealTime from './pages/RealTime';
import Settings from './pages/Settings';

// Hooks and Services
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Styles
import './App.css';

// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnMount: 'always',
    },
    mutations: {
      retry: 1,
    }
  },
});

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3
};

// Error boundary error handler
const errorHandler = (error: Error, errorInfo: any) => {
  console.error('Application Error:', error, errorInfo);
  // Here you could send error reports to a service like Sentry
};

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={errorHandler}
      onReset={() => window.location.reload()}
    >
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SocketProvider>
              <Router>
                <div className="App min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
                  <Toaster 
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: 'var(--toast-bg)',
                        color: 'var(--toast-color)',
                        borderRadius: '12px',
                        padding: '16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      },
                      success: {
                        iconTheme: {
                          primary: '#10B981',
                          secondary: '#FFFFFF',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: '#EF4444',
                          secondary: '#FFFFFF',
                        },
                      },
                      loading: {
                        iconTheme: {
                          primary: '#6366F1',
                          secondary: '#FFFFFF',
                        },
                      },
                    }}
                  />
                  
                  <div className="flex min-h-screen">
                    <Sidebar />
                    
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <Header />
                      
                      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent">
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                          <AnimatePresence mode="wait">
                            <Suspense fallback={
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                <LoadingSpinner />
                              </motion.div>
                            }>
                              <Routes>
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                
                                <Route 
                                  path="/dashboard" 
                                  element={
                                    <motion.div
                                      initial="initial"
                                      animate="in"
                                      exit="out"
                                      variants={pageVariants}
                                      transition={pageTransition}
                                      key="dashboard"
                                    >
                                      <Dashboard />
                                    </motion.div>
                                  } 
                                />
                                
                                <Route 
                                  path="/analytics" 
                                  element={
                                    <motion.div
                                      initial="initial"
                                      animate="in"
                                      exit="out"
                                      variants={pageVariants}
                                      transition={pageTransition}
                                      key="analytics"
                                    >
                                      <Analytics />
                                    </motion.div>
                                  } 
                                />
                                
                                <Route 
                                  path="/countries" 
                                  element={
                                    <motion.div
                                      initial="initial"
                                      animate="in"
                                      exit="out"
                                      variants={pageVariants}
                                      transition={pageTransition}
                                      key="countries"
                                    >
                                      <Countries />
                                    </motion.div>
                                  } 
                                />
                                
                                <Route 
                                  path="/real-time" 
                                  element={
                                    <motion.div
                                      initial="initial"
                                      animate="in"
                                      exit="out"
                                      variants={pageVariants}
                                      transition={pageTransition}
                                      key="real-time"
                                    >
                                      <RealTime />
                                    </motion.div>
                                  } 
                                />
                                
                                <Route 
                                  path="/settings" 
                                  element={
                                    <motion.div
                                      initial="initial"
                                      animate="in"
                                      exit="out"
                                      variants={pageVariants}
                                      transition={pageTransition}
                                      key="settings"
                                    >
                                      <Settings />
                                    </motion.div>
                                  } 
                                />
                                
                                <Route 
                                  path="*" 
                                  element={
                                    <motion.div
                                      initial="initial"
                                      animate="in"
                                      exit="out"
                                      variants={pageVariants}
                                      transition={pageTransition}
                                      key="not-found"
                                    >
                                      <NotFound />
                                    </motion.div>
                                  } 
                                />
                              </Routes>
                            </Suspense>
                          </AnimatePresence>
                        </div>
                      </main>
                    </div>
                  </div>
                </div>
              </Router>
            </SocketProvider>
          </ThemeProvider>
          
          {/* React Query Devtools - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools 
              initialIsOpen={false} 
              position="bottom-right"
              toggleButtonProps={{
                style: {
                  marginLeft: '5px',
                  background: '#FF6B6B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }
              }}
            />
          )}
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;