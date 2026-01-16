import React, { useEffect, useRef, useState } from "react";
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
  // Map route -> granular permission key
  const routePermissionMap = {
    '/visa-board': 'visa_board',
  };

  const requestedPermission = routePermissionMap[location.pathname];

  // If this is a staff user and a route requires granular permission, start in loading
  const [loading, setLoading] = useState(Boolean(user && user.role === 'staff' && requestedPermission));
  const [granularAllowed, setGranularAllowed] = useState(false);

  // Reset toast flag when location changes
  useEffect(() => {
    hasShownToast.current = false;
    setGranularAllowed(false);
  }, [location.pathname]);

  // Not Authenticated: Redirect to login with return URL
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is allowed by role list, short-circuit allow
  if (allowedRoles.includes(user.role)) {
    return <Outlet />;
  }

  useEffect(() => {
    let mounted = true;
    const checkGranular = async () => {
      if (user.role !== 'staff' || !requestedPermission) return;
      setLoading(true);
      try {
        const res = await window.electronAPI.getUserGranularPermissions({ userId: user.id });
        if (res && res.success && mounted) {
          setGranularAllowed(Boolean(res.data && res.data[requestedPermission] === true));
        }
      } catch (err) {
        console.warn('Granular permission check failed:', err && err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkGranular();
    return () => {
      mounted = false;
    };
  }, [user, requestedPermission]);

  if (loading) return null;

  if (granularAllowed) return <Outlet />;

  // Show access denied toast after render to avoid React setState-in-render warnings
  useEffect(() => {
    if (loading) return;
    if (allowedRoles.includes(user.role)) return;
    if (granularAllowed) return;

    if (!hasShownToast.current) {
      toast.error(
        `Access Denied. Your role (${user.role}) is not permitted to view this page.`,
        {
          id: 'access-denied',
          duration: 4000,
          icon: '🚫',
        }
      );
      hasShownToast.current = true;
    }
  }, [loading, granularAllowed, user.role, allowedRoles]);

  return <Navigate to="/" replace />;
}

export default ProtectedRoute;
