import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import toast from "react-hot-toast";

/**
 * Component to protect routes based on user role.
 * @param {object} user - The current logged-in user object.
 * @param {string[]} allowedRoles - Array of roles allowed to view the page (e.g., ['admin', 'super_admin']).
 * @returns {JSX.Element}
 */
function ProtectedRoute({ user, allowedRoles }) {
  // 1. Not Authenticated: Redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Unauthorized: Redirect to dashboard
  if (!allowedRoles.includes(user.role)) {
    // Show a toast message to the user
    toast.error(
      `Access Denied. Your role (${user.role}) is not permitted to view this page.`,
      {
        id: "access-denied", // Prevents multiple rapid toasts
        duration: 3000,
      },
    );
    // Redirect to the default dashboard
    return <Navigate to="/" replace />;
  }

  // 3. Authorized: Render the nested route component
  return <Outlet />;
}

export default ProtectedRoute;
