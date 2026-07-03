import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Alarm, User, Vehicle } from '../types';
import { Clock, Navigation } from 'lucide-react';

// Fix for default marker icon in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DriverLocation {
  driverId: number;
  driverName: string;
  vehicleId?: number;
  lat: number;
  lng: number;
  lastUpdated: number;
  status?: 'available' | 'busy';
  activeAlarm?: Alarm;
  history?: { lat: number, lng: number, timestamp: number }[];
  isOffline?: boolean;
  isSOS?: boolean;
}

interface Props {
  locations: Record<number, DriverLocation>;
  alarms: Alarm[];
  drivers: User[];
  vehicles?: Vehicle[];
  onAssignDriver?: (alarmId: number, driverId: string) => void;
  selectedAlarmId?: number | null;
}

const createCustomIcon = (status: 'available' | 'busy' | 'dispatched', name: string, isOffline: boolean = false, isSOS: boolean = false) => {
  const outerRing = isSOS ? 'animate-pulse ring-4 ring-red-500 border-red-650' : 'border-white';
  const colorClass = isSOS 
    ? 'bg-red-600 text-white' 
    : isOffline 
      ? 'bg-slate-400 grayscale' 
      : status === 'dispatched' 
        ? 'bg-amber-500 text-white' 
        : status === 'busy' 
          ? 'bg-red-500 text-white' 
          : 'bg-rq-gold text-slate-900';
  const html = `
    <div class="flex flex-col items-center justify-center -mt-4 -ml-4 ${isOffline ? 'opacity-70' : ''} ${isSOS ? 'scale-110 z-50 animate-bounce' : ''}">
      <div class="w-8 h-8 ${colorClass} rounded-full border-2 ${outerRing} shadow-md flex items-center justify-center font-bold">
        ${isSOS ? 
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' :
          isOffline ? 
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'
        }
      </div>
      <div class="mt-1 px-2 py-0.5 ${isSOS ? 'bg-red-650 text-white border-red-700 animate-pulse font-black' : 'bg-white text-slate-800 border-slate-200 font-bold'} rounded shadow-sm text-[10px] whitespace-nowrap border">
        ${isSOS ? '🚨 ' : ''}${name} • ${isSOS ? 'EMERGENCY SOS' : isOffline ? 'OFFLINE' : status === 'dispatched' ? 'Dispatched' : status === 'busy' ? 'Busy' : 'Available'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-driver-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createAlarmIcon = (priority: string) => {
  let colorClass = 'bg-blue-500';
  if (priority === 'critical') colorClass = 'bg-red-500';
  else if (priority === 'high') colorClass = 'bg-amber-500';
  else if (priority === 'low') colorClass = 'bg-slate-500';

  const html = `
    <div class="flex flex-col items-center justify-center -mt-4 -ml-4">
      <div class="w-8 h-8 ${colorClass} rounded-full border-2 border-white shadow-md flex items-center justify-center text-white animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-alarm-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createVehicleIcon = (registration: string, color: string) => {
  const html = `
    <div class="flex flex-col items-center justify-center -mt-4 -ml-4">
      <div class="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white" style="background-color: ${color}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
      <div class="bg-white px-1.5 py-0.5 rounded shadow-sm text-[10px] font-bold text-slate-800 mt-1 whitespace-nowrap border border-slate-200">
        ${registration}
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const calculateETA = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  // Haversine formula to calculate distance
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directDistance = R * c;
  
  // Apply a "road factor" (usually 1.3 - 1.4 in cities to account for non-straight roads)
  const roadFactor = 1.35;
  const actualDistance = directDistance * roadFactor;
  
  // Assume average speed of 35 km/h in urban area (including traffic lights)
  const avgSpeed = 35;
  const timeInHours = actualDistance / avgSpeed;
  const timeInMinutes = Math.max(1, Math.round(timeInHours * 60));
  
  return {
    distance: actualDistance.toFixed(1),
    minutes: timeInMinutes
  };
};

// Generate a simulated route with a few intermediate points to follow a grid-like pattern
const generateRoutePoints = (start: [number, number], end: [number, number]): [number, number][] => {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;
  
  // For very short distances, return just start and end
  const dist = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
  if (dist < 0.001) return [start, end];

  // We'll create simple L/Z shaped segments to simulate road turns
  // Instead of a direct diagonal, we'll go partially in lat, then lng, then lat
  const midLat = lat1 + (lat2 - lat1) * 0.4;
  const midLng = lng1 + (lng2 - lng1) * 0.6;
  
  return [
    [lat1, lng1],
    [lat1, midLng],
    [midLat, midLng],
    [midLat, lng2],
    [lat2, lng2]
  ];
};

function VehicleMarker({ vehicle, activeDriverName }: { key?: number | string, vehicle: Vehicle, activeDriverName?: string }) {
  const map = useMap();

  if (!vehicle.lat || !vehicle.lng) return null;

  return (
    <Marker 
      position={[vehicle.lat, vehicle.lng]}
      icon={createVehicleIcon(vehicle.registration, vehicle.color || '#64748b')}
      eventHandlers={{
        click: () => {
          map.flyTo([vehicle.lat!, vehicle.lng!], Math.max(map.getZoom(), 14), {
            duration: 1.5
          });
        }
      }}
    >
      <Popup>
        <div className="font-semibold text-slate-900">{vehicle.registration}</div>
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
          <span>Color:</span>
          <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: vehicle.color || '#64748b' }}></div>
          <span className="text-slate-600 font-medium capitalize">{vehicle.color || '#64748b'}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Status: <span className={activeDriverName ? "text-amber-600 font-bold" : "text-slate-600 font-medium"}>
            {activeDriverName ? `Active (Driver: ${activeDriverName})` : 'Parked / Not in use'}
          </span>
        </div>
      </Popup>
    </Marker>
  );
}

function DriverMarker({ driver, vehicleRegistration }: { key?: number | string, driver: DriverLocation & { status: 'available' | 'busy', activeAlarm?: Alarm }, vehicleRegistration?: string }) {
  const map = useMap();

  const getStatusText = () => {
    if (driver.isSOS) {
      return 'EMERGENCY SOS';
    }
    if (driver.activeAlarm) {
      return driver.activeAlarm.status.replace('_', ' ');
    }
    return driver.status === 'busy' ? 'Busy' : 'Available';
  };

  const getStatusColor = () => {
    if (driver.isSOS) return 'text-red-650 animate-pulse font-black';
    if (driver.activeAlarm) {
      if (driver.activeAlarm.status === 'en_route') return 'text-blue-600';
      if (driver.activeAlarm.status === 'arrived') return 'text-amber-600';
      return 'text-amber-600';
    }
    return driver.status === 'busy' ? 'text-red-600' : 'text-rq-gold';
  };

  return (
    <Marker 
      position={[driver.lat, driver.lng]}
      icon={createCustomIcon(driver.activeAlarm ? 'dispatched' : driver.status || 'available', driver.driverName, driver.isOffline, !!driver.isSOS)}
      eventHandlers={{
        click: () => {
          map.flyTo([driver.lat, driver.lng], Math.max(map.getZoom(), 14), {
            duration: 1.5
          });
        }
      }}
    >
      <Popup>
        {driver.isSOS && (
          <div className="bg-red-600 border border-red-500 text-white font-black text-[10px] px-2 py-1 rounded text-center animate-pulse mb-2">
            🚨 EMERGENCY ASSISTANCE REQUESTED 🚨
          </div>
        )}
        <div className="font-semibold text-slate-900">{driver.driverName}</div>
        {vehicleRegistration && (
          <div className="text-xs text-blue-600 font-bold mt-0.5 flex items-center gap-1">
            <Navigation size={10} /> {vehicleRegistration}
          </div>
        )}
        <div className="text-xs text-slate-500 mt-1">
          Status: <span className={`font-bold capitalize ${driver.isOffline ? 'text-slate-400' : getStatusColor()}`}>
            {driver.isOffline ? 'Offline (No signal)' : getStatusText()}
          </span>
        </div>
        {driver.activeAlarm && (
          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100 text-xs">
            <div className="font-semibold text-amber-900">{driver.activeAlarm.client_name}</div>
            <div className="text-amber-700 mt-0.5">{driver.activeAlarm.address}</div>
            <div className="text-[10px] text-amber-600 mt-1 font-medium">Priority: {driver.activeAlarm.priority}</div>
          </div>
        )}
        <div className="text-[10px] text-slate-400 mt-2 flex flex-col gap-0.5">
          <div>Last updated: {new Date(driver.lastUpdated).toLocaleTimeString()}</div>
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <RelativeTime timestamp={driver.lastUpdated} />
          </div>
          {driver.history && <div>Points in trail: {driver.history.length}</div>}
        </div>
      </Popup>
    </Marker>
  );
}

function AlarmMarker({ alarm, drivers, alarms, onAssignDriver }: { key?: number | string, alarm: Alarm, drivers: User[], alarms: Alarm[], onAssignDriver?: (alarmId: number, driverId: string) => void }) {
  const map = useMap();
  if (!alarm.lat || !alarm.lng) return null;

  return (
    <Marker 
      position={[alarm.lat, alarm.lng]}
      icon={createAlarmIcon(alarm.priority)}
      eventHandlers={{
        click: () => {
          map.flyTo([alarm.lat!, alarm.lng!], Math.max(map.getZoom(), 14), {
            duration: 1.5
          });
        }
      }}
    >
      <Popup>
        <div className="font-semibold text-slate-900">{alarm.client_name}</div>
        <div className="text-xs text-slate-500 mt-1">
          Priority: <span className="font-medium uppercase">{alarm.priority}</span>
        </div>
        <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 text-xs">
          <div className="font-medium text-slate-800">{alarm.address}</div>
          <div className="text-slate-500 mt-1">Type: {alarm.alarm_type}</div>
          <div className="text-slate-500 mt-0.5">Status: {alarm.status}</div>
        </div>
        {alarm.status === 'pending' && onAssignDriver && (
          <div className="mt-3">
            <select
              onChange={(e) => onAssignDriver(alarm.id, e.target.value)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              defaultValue=""
            >
              <option value="" disabled>Assign Driver</option>
              {drivers.filter(d => {
                const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === d.id && a.status === 'dispatched');
                return d.status !== 'busy' && !hasActiveAlarm;
              }).map(d => (
                <option key={d.id} value={d.id}>{d.username}</option>
              ))}
            </select>
          </div>
        )}
      </Popup>
    </Marker>
  );
}

function MapBounds({ drivers, alarms }: { drivers: DriverLocation[], alarms: Alarm[] }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    drivers.forEach(driver => {
      bounds.extend([driver.lat, driver.lng]);
      hasPoints = true;
    });

    alarms.forEach(alarm => {
      if (alarm.lat && alarm.lng) {
        bounds.extend([alarm.lat, alarm.lng]);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [drivers, alarms, map]);

  return null;
}

function RelativeTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000); // Update every 10s is enough
    return () => clearInterval(interval);
  }, []);

  const diff = Math.floor((now - timestamp) / 1000);
  if (diff < 60) return <span>Just now</span>;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return <span>{mins}m ago</span>;
  const hours = Math.floor(mins / 60);
  return <span>{hours}h ago</span>;
}

export default function DriverMap({ locations, alarms, drivers, vehicles = [], onAssignDriver, selectedAlarmId }: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  
  useEffect(() => {
    if (map && selectedAlarmId) {
      const alarm = alarms.find(a => a.id === selectedAlarmId);
      if (alarm && alarm.lat && alarm.lng) {
        map.flyTo([alarm.lat, alarm.lng], 16, { duration: 1.5 });
      }
    }
  }, [map, selectedAlarmId, alarms]);

  const driverList = useMemo(() => {
    return Object.values(locations).map(driver => {
      const activeAlarm = alarms.find(a => a.assigned_driver_id === driver.driverId && ['dispatched', 'en_route', 'arrived'].includes(a.status));
      const dbDriver = drivers.find(d => d.id === driver.driverId);
      const status: 'available' | 'busy' = activeAlarm ? 'busy' : (dbDriver?.status || 'available');
      return { ...driver, status, activeAlarm };
    }).sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'available' ? -1 : 1;
      }
      return a.driverName.localeCompare(b.driverName);
    });
  }, [locations, alarms, drivers]);
  
  const vehicleToDriverMap = useMemo(() => {
    const map: Record<number, string> = {};
    driverList.forEach(d => {
      if (d.vehicleId) map[d.vehicleId] = d.driverName;
    });
    return map;
  }, [driverList]);

  const allVehiclesWithLocation = useMemo(() => vehicles.filter(v => v.lat && v.lng), [vehicles]);

  // Default center (can be adjusted to a specific city)
  const defaultCenter: [number, number] = [-26.2041, 28.0473]; // Johannesburg as example
  const center = driverList.length > 0 ? [driverList[0].lat, driverList[0].lng] as [number, number] : defaultCenter;

  const activeAlarmsWithLocation = useMemo(() => alarms.filter(a => (a.status === 'dispatched' || a.status === 'pending') && a.lat && a.lng), [alarms]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">Live Map</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-rq-gold"></span> Available
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Dispatched
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-red-500"></span> Busy
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Active Alarm
          </div>
          <span className="bg-rq-gold/20 text-rq-gold text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 rounded-full bg-rq-gold animate-pulse"></span>
            {driverList.length} Drivers
          </span>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full bg-slate-400"></span> Parked
          </div>
        </div>
      </div>
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="w-64 flex flex-col gap-3 overflow-y-auto pr-2">
          {driverList.map(driver => (
            <div 
              key={driver.driverId} 
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                driver.isSOS 
                  ? 'bg-red-600 border-red-500 hover:bg-red-700 text-white animate-pulse shadow-md ring-2 ring-red-400' 
                  : driver.isOffline 
                    ? 'bg-red-50 border-red-200 hover:bg-red-100 text-slate-800' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
              }`}
              onClick={() => {
                if (map) {
                  map.flyTo([driver.lat, driver.lng], Math.max(map.getZoom(), 14), { duration: 1.5 });
                }
              }}
            >
               <div className="flex items-center justify-between">
                 <div className={`font-semibold text-sm ${driver.isSOS ? 'text-white font-black' : driver.isOffline ? 'text-red-900 font-black' : 'text-slate-900'}`}>{driver.driverName}</div>
                 {driver.isSOS ? (
                   <span className="text-[9px] font-black text-red-600 bg-white px-1.5 py-0.5 rounded animate-bounce shadow-sm">SOS ACTIVE</span>
                 ) : driver.isOffline ? (
                   <span className="text-[9px] font-black text-white bg-red-600 px-1.5 py-0.5 rounded animate-pulse shadow-sm">OFFLINE</span>
                 ) : null}
               </div>
               <div className="flex items-center justify-between mt-1">
                 <div className="flex items-center gap-1.5">
                   <span className={`w-2 h-2 rounded-full ${driver.isSOS ? 'bg-white animate-[ping_1.5s_infinite]' : driver.isOffline ? 'bg-slate-400' : driver.status === 'busy' ? (driver.activeAlarm ? 'bg-amber-500' : 'bg-red-500') : 'bg-rq-gold'}`}></span>
                   <span className={`text-xs capitalize ${driver.isSOS ? 'text-white font-bold' : 'text-slate-600'}`}>
                     {driver.isSOS ? 'EMERGENCY SOS' : driver.isOffline ? 'Offline' : (driver.status === 'busy' ? (driver.activeAlarm ? 'Dispatched' : 'Busy') : 'Available')}
                   </span>
                 </div>
               </div>
               {driver.activeAlarm && (
                 <div className={`mt-2 text-xs p-1.5 rounded border ${driver.isSOS ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-100 text-slate-800'}`}>
                   <div className="font-medium truncate">{driver.activeAlarm.client_name}</div>
                   <div className={`truncate text-[10px] ${driver.isSOS ? 'text-white/85' : 'text-slate-500'}`}>{driver.activeAlarm.address}</div>
                 </div>
               )}
               <div className={`text-[10px] mt-2 flex items-center justify-between ${driver.isSOS ? 'text-white/80' : 'text-slate-500'}`}>
                 <span>Updated: {new Date(driver.lastUpdated).toLocaleTimeString()}</span>
                 <RelativeTime timestamp={driver.lastUpdated} />
               </div>
             </div>
          ))}
          {driverList.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">No active drivers</div>
          )}
          
          {allVehiclesWithLocation.filter(v => !vehicleToDriverMap[v.id]).length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Parked Vehicles</h4>
              <div className="flex flex-col gap-2">
                {allVehiclesWithLocation.filter(v => !vehicleToDriverMap[v.id]).map(vehicle => (
                  <div 
                    key={`v-${vehicle.id}`}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
                    onClick={() => {
                      if (map && vehicle.lat && vehicle.lng) {
                        map.flyTo([vehicle.lat, vehicle.lng], Math.max(map.getZoom(), 14), { duration: 1.5 });
                      }
                    }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: vehicle.color || '#64748b' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                    </div>
                    <span className="font-medium text-sm text-slate-700">{vehicle.registration}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative z-0">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} ref={setMap}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MarkerClusterGroup chunkedLoading>
              {driverList.map((driver) => (
                <React.Fragment key={driver.driverId}>
                  {driver.history && driver.history.length > 1 && (
                    <Polyline 
                      positions={driver.history.map(p => [p.lat, p.lng] as [number, number])}
                      color="#E2D670"
                      weight={3}
                      opacity={0.5}
                      dashArray="5, 10"
                    />
                  )}
                  <DriverMarker 
                    driver={driver} 
                    vehicleRegistration={vehicles.find(v => v.id === driver.vehicleId)?.registration} 
                  />
                  {driver.activeAlarm && driver.activeAlarm.lat && driver.activeAlarm.lng && (
                    <React.Fragment>
                      {(() => {
                        const eta = calculateETA(driver.lat, driver.lng, driver.activeAlarm.lat, driver.activeAlarm.lng);
                        const routePoints = generateRoutePoints([driver.lat, driver.lng], [driver.activeAlarm.lat, driver.activeAlarm.lng]);
                        return (
                          <Polyline 
                            positions={routePoints}
                            color="#3b82f6"
                            weight={5}
                            opacity={0.6}
                          >
                            <Tooltip permanent direction="top" className="eta-tooltip">
                              <div className="flex flex-col gap-0.5 bg-white px-2 py-1.5 rounded-lg shadow-lg border-2 border-blue-100 min-w-[80px]">
                                <div className="flex items-center gap-1.5">
                                  <Clock size={14} className="text-blue-600" />
                                  <span className="text-[11px] font-black text-slate-900">
                                    {eta.minutes} MIN
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 border-t border-slate-100 pt-0.5 mt-0.5">
                                  <Navigation size={10} className="text-slate-400" />
                                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                                    {eta.distance} km
                                  </span>
                                </div>
                              </div>
                            </Tooltip>
                          </Polyline>
                        );
                      })()}
                    </React.Fragment>
                  )}
                </React.Fragment>
              ))}
              {allVehiclesWithLocation.map(vehicle => (
                <VehicleMarker 
                  key={`vehicle-${vehicle.id}`} 
                  vehicle={vehicle} 
                  activeDriverName={vehicleToDriverMap[vehicle.id]}
                />
              ))}
              {activeAlarmsWithLocation.map((alarm) => (
                <AlarmMarker key={`alarm-${alarm.id}`} alarm={alarm} drivers={drivers} alarms={alarms} onAssignDriver={onAssignDriver} />
              ))}
            </MarkerClusterGroup>
            
            <MapBounds drivers={driverList} alarms={activeAlarmsWithLocation} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
