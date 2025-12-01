import useAuthStore from '../store/useAuthStore';
import usePermissionStore from '../store/usePermissionStore';

const usePermission = () => {
  const user = useAuthStore(state => state.user);
  const { permissions } = usePermissionStore(state => ({
    permissions: state.permissions || [],
  }));

  const hasPermission = moduleKey => {
    if (!moduleKey) return true;

    // Super Admin: always allowed
    if (user?.role === 'super_admin') return true;

    // Admin: do not block; always allowed
    if (user?.role === 'admin') return true;

    // Staff: must have explicit permission
    const perm = permissions.find(p => p.module_key === moduleKey);
    if (!perm) return false;
    return perm.is_enabled !== false && perm.is_enabled !== 0;
  };

  return { hasPermission };
};

export default usePermission;
