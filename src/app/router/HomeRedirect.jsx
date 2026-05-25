import React from 'react';
import { Navigate } from 'react-router-dom';
import { getStoredUser } from '../../services/authStorage';

export default function HomeRedirect() {
  const currentUser = getStoredUser();

  if (currentUser?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
