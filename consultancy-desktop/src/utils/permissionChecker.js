// FILE: src/utils/permissionChecker.js
// ✅ NEW FILE - Granular Permission Checker

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with role
 * @param {Object} permissions - Granular permissions object
 * @param {string} permissionKey - Permission key (e.g., 'candidates.search')
 * @returns {boolean}
 */
export function hasPermission(user, permissions, permissionKey) {
  // Super Admin has all permissions
  if (user?.role === 'super_admin') {
    return true;
  }
  
  // Check granular permissions
  if (permissions && typeof permissions === 'object') {
    return permissions[permissionKey] === true;
  }
  
  return false;
}

/**
 * Check if user has any of the permissions
 */
export function hasAnyPermission(user, permissions, permissionKeys = []) {
  if (user?.role === 'super_admin') return true;
  
  return permissionKeys.some(key => hasPermission(user, permissions, key));
}

/**
 * Check if user has all permissions
 */
export function hasAllPermissions(user, permissions, permissionKeys = []) {
  if (user?.role === 'super_admin') return true;
  
  return permissionKeys.every(key => hasPermission(user, permissions, key));
}

/**
 * Filter items based on required permission
 */
export function filterByPermission(user, permissions, items, getPermissionKey) {
  if (user?.role === 'super_admin') return items;
  
  return items.filter(item => {
    const key = typeof getPermissionKey === 'function' 
      ? getPermissionKey(item) 
      : item.permissionKey;
    return hasPermission(user, permissions, key);
  });
}

export default {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  filterByPermission
};
