import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePermissionStore from '../store/usePermissionStore';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';

/**
 * Custom hook for permission checking
 */
export const usePermission = (requiredPermission = null) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    isLoaded,
  } = usePermissionStore();

  // Check single permission
  const can = (moduleKey) => {
    // SuperAdmin can do everything
    if (user?.role === 'super_admin') return true;
    return hasPermission(moduleKey);
  };

  // Check any permission
  const canAny = (moduleKeys) => {
    if (user?.role === 'super_admin') return true;
    return hasAnyPermission(moduleKeys);
  };

  // Check all permissions
  const canAll = (moduleKeys) => {
    if (user?.role === 'super_admin') return true;
    return hasAllPermissions(moduleKeys);
  };

  // Check route access
  const canRoute = (route) => {
    if (user?.role === 'super_admin') return true;
    return canAccessRoute(route);
  };

  // Protect component with permission
  useEffect(() => {
    if (requiredPermission && isLoaded) {
      if (!can(requiredPermission)) {
        toast.error('Access denied: You do not have permission to view this page');
        navigate('/');
      }
    }
  }, [requiredPermission, isLoaded]);

  return {
    can,
    canAny,
    canAll,
    canRoute,
    isLoaded,
  };
};

/**
 * Hook for requiring permission (throws error if denied)
 */
export const useRequirePermission = (moduleKey) => {
  const { can, isLoaded } = usePermission();

  useEffect(() => {
    if (isLoaded && !can(moduleKey)) {
      throw new Error(`Permission denied: ${moduleKey}`);
    }
  }, [moduleKey, isLoaded, can]);

  return can(moduleKey);
};

/**
 * Hook for checking multiple permissions
 */
export const usePermissions = (moduleKeys) => {
  const { can } = usePermission();
  const permissions = {};

  moduleKeys.forEach((key) => {
    permissions[key] = can(key);
  });

  return permissions;
};

/**
 * HOC to protect routes with permission
 */
export const withPermission = (Component, requiredPermission) => {
  return (props) => {
    usePermission(requiredPermission);
    return <Component {...props} />;
  };
};