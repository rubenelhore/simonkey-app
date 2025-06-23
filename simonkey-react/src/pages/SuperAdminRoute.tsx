import React from 'react';
import { useUserType } from '../hooks/useUserType';
import { Navigate } from 'react-router-dom';
import SuperAdminPage from './SuperAdminPage';
import { auth } from '../services/firebase';

const SuperAdminRoute: React.FC = () => {
  const { isSuperAdmin, loading: userTypeLoading } = useUserType();

  if (userTypeLoading) return null; // o un loader

  if (isSuperAdmin) {
    return <SuperAdminPage />;
  } else if (auth.currentUser?.email?.includes('@school.simonkey.com') || auth.currentUser?.email?.includes('@up.edu.mx')) {
    return <Navigate to="/school/teacher" replace />;
  } else if (!auth.currentUser) {
    return <Navigate to="/login" replace />;
  } else {
    return <Navigate to="/notebooks" replace />;
  }
};

export default SuperAdminRoute; 