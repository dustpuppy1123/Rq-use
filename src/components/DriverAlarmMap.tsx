import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Alarm } from '../types';
import { Clock, Car } from 'lucide-react';

// Fix for default marker icon in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

const createDriverIcon = () => {
  const html = `
    <div class="flex flex-col items-center justify-center -mt-4 -ml-4">
      <div class="w-8 h-8 bg-rq-gold rounded-full border-2 border-white shadow-md flex items-center justify-center text-slate-900 font-bold">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
      <div class="mt-1 px-2 py-0.5 bg-white rounded shadow-sm text-[10px] font-bold text-slate-800 whitespace-nowrap border border-slate-200">
        You
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

function MapBounds({ alarms, driverLocation }: { alarms: Alarm[], driverLocation: {lat: number, lng: number} | null }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    if (driverLocation) {
      bounds.extend([driverLocation.lat, driverLocation.lng]);
      hasPoints = true;
    }

    alarms.forEach(alarm => {
      if (alarm.lat && alarm.lng) {
        bounds.extend([alarm.lat, alarm.lng]);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [alarms, driverLocation, map]);

  return null;
}

interface Props {
  alarms: Alarm[];
  driverLocation: { lat: number, lng: number } | null;
  etas?: Record<number, { duration: number, distance: number }>;
}

export default function DriverAlarmMap({ alarms, driverLocation, etas = {} }: Props) {
  const defaultCenter: [number, number] = [-26.2041, 28.0473]; // Johannesburg
  const center = driverLocation ? [driverLocation.lat, driverLocation.lng] as [number, number] : defaultCenter;

  const alarmsWithLocation = alarms.filter(a => a.lat && a.lng);

  if (!driverLocation && alarmsWithLocation.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-[300px] mb-6 relative z-0">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MarkerClusterGroup chunkedLoading>
          {driverLocation && (
            <Marker position={[driverLocation.lat, driverLocation.lng]} icon={createDriverIcon()}>
              <Popup>Your Location</Popup>
            </Marker>
          )}
          
          {alarmsWithLocation.map((alarm) => (
            <Marker key={alarm.id} position={[alarm.lat!, alarm.lng!]} icon={createAlarmIcon(alarm.priority)}>
              <Popup>
                <div className="font-semibold text-slate-900">{alarm.client_name}</div>
                <div className="text-xs text-slate-500 mt-1">{alarm.address}</div>
                {etas[alarm.id] && (
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-amber-600">
                    <Clock size={10} /> ETA: {Math.ceil(etas[alarm.id].duration / 60)} min
                  </div>
                )}
                {alarm.vehicle_registration && (
                  <div className="text-[10px] text-blue-600 font-bold mt-1 flex items-center gap-1">
                    <Car size={10} /> {alarm.vehicle_registration}
                  </div>
                )}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {alarmsWithLocation.map((alarm, index) => {
          const prevLocation = index === 0 && driverLocation 
            ? [driverLocation.lat, driverLocation.lng] 
            : index > 0 
              ? [alarmsWithLocation[index - 1].lat!, alarmsWithLocation[index - 1].lng!]
              : null;

          if (!prevLocation) return null;

          const eta = etas[alarm.id];

          return (
            <Polyline 
              key={`route-${alarm.id}`}
              positions={[
                prevLocation as [number, number],
                [alarm.lat!, alarm.lng!]
              ]}
              color="#f59e0b"
              weight={3}
              dashArray="5, 10"
              opacity={0.8}
            >
              {eta && (
                <Tooltip permanent direction="top" className="eta-tooltip">
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded shadow-sm border border-amber-200">
                    <Clock size={12} className="text-amber-600" />
                    <span className="text-[10px] font-bold text-slate-700">
                      ETA: {Math.ceil(eta.duration / 60)} min
                    </span>
                  </div>
                </Tooltip>
              )}
            </Polyline>
          );
        })}
        
        <MapBounds alarms={alarmsWithLocation} driverLocation={driverLocation} />
      </MapContainer>
    </div>
  );
}
