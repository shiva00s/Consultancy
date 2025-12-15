// src/utils/permissions.js
// Very simple placeholder – you can extend later without changing callers

export const hasPermission = (role, permissions, key) => {
  // Super admin always has full access
  if (!role) return false;
  if (role.toLowerCase() === 'super_admin' || role.toLowerCase() === 'super_admin') {
    return true;
  }

  // permissions is expected to be an object or array from redux
  if (!permissions) return false;

  // Object shape: { [key]: true/false }
  if (typeof permissions === 'object' && !Array.isArray(permissions)) {
    return Boolean(permissions[key]);
  }

  // Array shape: ['candidates:view', 'jobs:list', ...]
  if (Array.isArray(permissions)) {
    return permissions.includes(key);
  }

  return false;
};
