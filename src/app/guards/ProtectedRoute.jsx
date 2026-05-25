import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoredUser, isDoctorAuthenticated } from '../../services/authStorage';

const getFallbackRouteForRole = (role) => {
  if (role === 'admin') {
    return '/admin/dashboard';
  }

  if (role === 'doctor') {
    return '/dashboard';
  }

  // Patients do not have a general dashboard in this app.
  return '/login';
};

export default function ProtectedRoute({ children, allowedRoles = ['doctor', 'admin'] }) {
  const location = useLocation();
  const currentUser = getStoredUser();

  if (!isDoctorAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length > 0 && !allowedRoles.includes(currentUser?.role)) {
    const fallbackPath = getFallbackRouteForRole(currentUser?.role);

    if (fallbackPath === location.pathname) {
      return (
        <Navigate
          to="/login"
          state={{ from: location, message: 'Please log in with the correct account.' }}
          replace
        />
      );
    }

    return (
      <Navigate
        to={fallbackPath}
        state={{ from: location, message: 'Please log in with the correct account.' }}
        replace
      />
    );
  }

  return children;
}
