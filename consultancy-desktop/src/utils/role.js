import { FEATURES, SUPERADMIN_FEATURES, ADMIN_ALLOWED, STAFF_ALLOWED } from '../config/permissions';

export const USER_ROLES = {
  SUPERADMIN: 'SuperAdmin',
  ADMIN: 'Admin',
  STAFF: 'Staff',
};

export const canView = (userRole, featureKey) => {
  switch (userRole) {
    case USER_ROLES.SUPERADMIN:
      return SUPERADMIN_FEATURES.includes(featureKey);
    case USER_ROLES.ADMIN:
      return ADMIN_ALLOWED.includes(FEATURES[featureKey]);
    case USER_ROLES.STAFF:
      return STAFF_ALLOWED.includes(FEATURES[featureKey]);
    default:
      return false;
  }
};
