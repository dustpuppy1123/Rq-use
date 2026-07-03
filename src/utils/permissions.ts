import type { User } from '../types.ts';

export type Permission = 
  | 'view_map'
  | 'dispatch_alarms'
  | 'view_all_reports'
  | 'view_assigned_reports'
  | 'manage_vehicles'
  | 'manage_all_users'
  | 'manage_drivers';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'view_map', 
    'dispatch_alarms', 
    'view_all_reports', 
    'manage_vehicles', 
    'manage_all_users'
  ],
  control: [
    'view_map', 
    'dispatch_alarms', 
    'view_all_reports'
  ],
  supervisor: [
    'view_map', 
    'dispatch_alarms', // Can assign tasks
    'view_assigned_reports', // Granular: view specific reports
    'manage_vehicles', 
    'manage_drivers' // Granular: manage drivers only, not all users
  ],
  technician: [
    'manage_vehicles'
  ],
  driver: []
};

export const hasPermission = (user: User | undefined | null, permission: Permission): boolean => {
  if (!user || !user.role) return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  
  // Admin has all permissions implicitly, or we can just rely on the map
  if (user.role === 'admin') return true;
  
  // Some permissions imply others
  if (permission === 'manage_drivers' && permissions.includes('manage_all_users')) return true;
  if (permission === 'view_assigned_reports' && permissions.includes('view_all_reports')) return true;

  return permissions.includes(permission);
};
