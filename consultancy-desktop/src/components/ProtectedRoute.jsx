import React, { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

/**
 * Component to protect routes based on user role.
 * @param {object} user - The current logged-in user object.
 * @param {string[]} allowedRoles - Array of roles allowed to view the page (e.g., ['admin', 'super_admin']).
 * @returns {JSX.Element}
 */
function ProtectedRoute({ user, allowedRoles }) {
  const location = useLocation();
  const hasShownToast = useRef(false);

  // Reset toast flag when location changes
  useEffect(() => {
    hasShownToast.current = false;
  }, [location.pathname]);

  // 1. Not Authenticated: Redirect to login with return URL
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Unauthorized: Show toast once and redirect to dashboard
  if (!allowedRoles.includes(user.role)) {
    // Show toast only once per route attempt
    if (!hasShownToast.current) {
      toast.error(
        `Access Denied. Your role (${user.role}) is not permitted to view this page.`,
        {
          id: "access-denied",
          duration: 4000,
          icon: "🚫",
        }
      );
      hasShownToast.current = true;
    }

    return <Navigate to="/" replace />;
  }

  // 3. Authorized: Render the nested route component
  return <Outlet />;
}

export default ProtectedRoute;
