export interface User {
  id: number;
  username: string;
  role: 'admin' | 'control' | 'driver' | 'supervisor' | 'technician';
  status?: 'available' | 'busy';
  is_on_shift?: boolean;
  password?: string;
  pin?: string;
}

export interface Vehicle {
  id: number;
  registration: string;
  lat?: number;
  lng?: number;
  color?: string;
}

export interface Alarm {
  id: number;
  client_name: string;
  address: string;
  status: 'pending' | 'dispatched' | 'en_route' | 'arrived' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_driver_id: number;
  vehicle_id?: number;
  vehicle_registration?: string;
  dispatcher_id?: number;
  lat?: number;
  lng?: number;
  driver_name?: string;
  client_phone?: string;
  alarm_type?: string;
  incident_details?: string;
  created_at: string;
}

export interface Feedback {
  id: number;
  alarm_id: number;
  driver_id: number;
  vehicle_id: number;
  client_name: string;
  address: string;
  feedback_text: string;
  image_analysis?: string;
  driver_name?: string;
  vehicle_registration?: string;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
  created_at: string;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  newDispatches: boolean;
  statusUpdates: boolean;
  feedbacks: boolean;
}

export interface ActivityLog {
  id: number;
  user_id?: number | null;
  username?: string | null;
  role?: string | null;
  action: string;
  details: string;
  created_at: string;
}

