import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { routes } from './app/router';
import ProtectedRoute from './app/guards/ProtectedRoute';
import DashboardLayout from './app/layouts/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/ui/Toast';
import { ToastProvider } from './contexts/ToastContext';
import useInactivityLogout from './hooks/useInactivityLogout';

// Loading component
const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-premium-surface">
    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-premium-purple-plum"></div>
  </div>
);

function App() {
  useInactivityLogout();

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {routes.map(({ path, element: Element, isPublic, allowedRoles, useLayout = true }) => (
              <Route
                key={path}
                path={path}
                element={
                  isPublic ? (
                    <Element />
                  ) : !useLayout ? (
                    <ProtectedRoute allowedRoles={allowedRoles}>
                      <Element />
                    </ProtectedRoute>
                  ) : (
                    <ProtectedRoute allowedRoles={allowedRoles}>
                      <DashboardLayout>
                        <Element />
                      </DashboardLayout>
                    </ProtectedRoute>
                  )
                }
              />
            ))}
          </Routes>
        </Suspense>
        <ToastContainer />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
