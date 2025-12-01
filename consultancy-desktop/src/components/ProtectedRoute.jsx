import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import usePermission from '../hooks/usePermission';

function ProtectedRoute({ moduleKey, children }) {
  const { user, isAuthenticated } = useAuthStore();
  const { hasPermission } = usePermission();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 1) Super Admin: full access, no checks
  if (user.role === 'super_admin') {
    return children;
  }

  // 2) Admin: full access to all pages (no blocking)
  if (user.role === 'admin') {
    return children;
  }

  // 3) Staff: strict permission check
  if (moduleKey && !hasPermission(moduleKey)) {
    return (
      <div className="page-access-denied">
        Access Denied.
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
