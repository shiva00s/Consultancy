export async function getEffectivePermissions(user) {
  // SuperAdmin gets everything
  if (user.role === 'super_admin') {
    return "superadmin";
  }
  // Load from DB via electronAPI
  const res = await window.electronAPI.getUserGranularPermissions({ userId: user.id });
  if (res.success) return res.data || {};
  return {};
}

// Synchronous version for sidebar, with permissions pre-passed
export function canAccess(permissionKey, user, permissions) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return permissions && permissions[permissionKey] === true;
}
