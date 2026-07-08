import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Vehicle, Alarm } from '../types';
import { Car, MapPin, Clock, CheckCircle2, AlertCircle, Bell, X, Smartphone, LogOut, Settings as SettingsIcon, AlertTriangle, Volume2, VolumeX, Activity, History } from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import { io } from 'socket.io-client';
import Logo from './Logo';
import ProfileSettings from './ProfileSettings';
import { requestNotificationPermission, showPushNotification, subscribeToPushNotifications } from '../utils/notifications';
import DriverAlarmMap from './DriverAlarmMap';
import DriverPerformance from './DriverPerformance';
import DriverHistory from './DriverHistory';
import React from 'react';

interface DriverDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function DriverDashboard({ user, onLogout }: DriverDashboardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'dispatches' | 'performance' | 'history'>('dispatches');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`rq_tts_enabled_${user.id}`) !== 'false';
  });
  const ttsEnabledRef = useRef<boolean>(ttsEnabled);
  
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
    localStorage.setItem(`rq_tts_enabled_${user.id}`, ttsEnabled ? 'true' : 'false');
  }, [ttsEnabled, user.id]);

  const speakDispatch = useCallback((alarm: Alarm) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    
    const client = alarm.client_name || 'unknown client';
    const type = alarm.alarm_type ? `${alarm.alarm_type} alarm` : 'alarm';
    const location = alarm.address || 'assigned location';
    const priorityText = alarm.priority ? `, priority level is ${alarm.priority}` : '';
    const details = alarm.incident_details ? `. Details reported: ${alarm.incident_details}` : '';
    
    const utteranceText = `Attention responder. You have a new dispatch. Incident type is: ${type}. Monitored site: ${client}. Location address is: ${location}${priorityText}${details}. Please navigate safely.`;
    
    const utterance = new SpeechSynthesisUtterance(utteranceText);
    utterance.volume = 1;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const bestVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('natural')) || 
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];
      utterance.voice = bestVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    const stored = localStorage.getItem(`rq_alarms_${user.id}`);
    return stored ? JSON.parse(stored) : [];
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [offlineReports, setOfflineReports] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('rq_offline_feedbacks') || '[]');
    } catch {
      return [];
    }
  });

  const [offlineStatuses, setOfflineStatuses] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('rq_offline_statuses') || '[]');
    } catch {
      return [];
    }
  });

  const [indexedDBQueue, setIndexedDBQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchIndexedDBQueue = useCallback(() => {
    return new Promise<void>((resolve) => {
      const request = indexedDB.open('rq-offline-db', 1);
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pending-sync')) {
          setIndexedDBQueue([]);
          resolve();
          return;
        }
        try {
          const transaction = db.transaction(['pending-sync'], 'readonly');
          const store = transaction.objectStore('pending-sync');
          const getReq = store.getAll();
          getReq.onsuccess = (e: any) => {
            setIndexedDBQueue(e.target.result || []);
            resolve();
          };
          getReq.onerror = () => {
            setIndexedDBQueue([]);
            resolve();
          };
        } catch {
          setIndexedDBQueue([]);
          resolve();
        }
      };
      request.onerror = () => {
        setIndexedDBQueue([]);
        resolve();
      };
    });
  }, []);

  useEffect(() => {
    const reloadOfflineDataState = () => {
      try {
        setOfflineReports(JSON.parse(localStorage.getItem('rq_offline_feedbacks') || '[]'));
        setOfflineStatuses(JSON.parse(localStorage.getItem('rq_offline_statuses') || '[]'));
        fetchIndexedDBQueue();
      } catch (error) {
        console.error('Failed to reload offline state list', error);
      }
    };
    
    fetchIndexedDBQueue();
    
    window.addEventListener('rq_offline_updated', reloadOfflineDataState);
    return () => {
      window.removeEventListener('rq_offline_updated', reloadOfflineDataState);
    };
  }, [fetchIndexedDBQueue]);

  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, message: string}[]>([]);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const locationRef = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    locationRef.current = driverLocation;
  }, [driverLocation]);
  const [driverStatus, setDriverStatus] = useState<'available' | 'busy'>(user.status || 'available');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [etas, setEtas] = useState<Record<number, { duration: number, distance: number }>>({});
  const lastETAFetchRef = useRef<number>(0);

  const socketRef = useRef<any>(null);
  const [isSOS, setIsSOS] = useState(() => {
    return localStorage.getItem(`rq_driver_sos_${user.id}`) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(`rq_driver_sos_${user.id}`, isSOS ? 'true' : 'false');
  }, [isSOS, user.id]);

  const handleSOSToggle = () => {
    const nextSOS = !isSOS;
    setIsSOS(nextSOS);
    
    if (socketRef.current) {
      socketRef.current.emit('driver_sos', {
        driverId: user.id,
        driverName: user.username,
        isSOS: nextSOS
      });
      
      if (driverLocation) {
        socketRef.current.emit('driver_location_update', {
          driverId: user.id,
          driverName: user.username,
          vehicleId: selectedVehicle?.id,
          isSOS: nextSOS,
          ...driverLocation
        });
      }
    }
  };

  const fetchETAs = useCallback(async () => {
    if (!driverLocation || alarms.length === 0) return;
    
    // Throttling to avoid hitting OSRM too hard (max once every 15 seconds)
    const now = Date.now();
    if (now - lastETAFetchRef.current < 15000) return;
    lastETAFetchRef.current = now;

    try {
      // Calculate ETA for everything in the queue sequentially for simplicity
      // In a real app, you might want to use the 'table' service or one big 'trip'
      // But for a few alarms, individual routes are fine or one route with many destinations.
      
      const newEtas: Record<number, { duration: number, distance: number }> = {};
      
      // We'll calculate route from driver to 1st alarm, 1st to 2nd, etc.
      let currentOrigin = driverLocation;
      
      for (const alarm of alarms) {
        if (!alarm.lat || !alarm.lng) continue;
        
        const coords = `${currentOrigin.lng},${currentOrigin.lat};${alarm.lng},${alarm.lat}`;
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const { duration, distance } = data.routes[0];
          newEtas[alarm.id] = { duration, distance };
          
          // Update origin for next segment calculation (if we want cumulative ETA)
          // For now, let's just do individual segment ETAs
          // currentOrigin = { lat: alarm.lat, lng: alarm.lng };
        }
      }
      
      setEtas(newEtas);
    } catch (error) {
      console.error("Error fetching ETAs:", error);
    }
  }, [driverLocation, alarms]);

  useEffect(() => {
    if (driverLocation && alarms.length > 0) {
      fetchETAs();
    }
  }, [driverLocation, alarms, fetchETAs]);

  const [shiftActive, setShiftActive] = useState(() => {
    const localActive = localStorage.getItem(`rq_shift_active_${user.id}`) === 'true';
    return localActive || !!user.is_on_shift;
  });
  const [deviceShiftConfirmed, setDeviceShiftConfirmed] = useState(() => {
    return localStorage.getItem(`rq_shift_active_${user.id}`) === 'true';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [wakeLockRequested, setWakeLockRequested] = useState(() => {
    return localStorage.getItem(`rq_shift_active_${user.id}`) === 'true';
  });
  const [shiftSummary, setShiftSummary] = useState<{
    startTime: string;
    endTime: string;
    durationMinutes: number;
    alarmsCompleted: number;
    distanceCovered: number;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const alarmId = params.get('alarmId');
    if (alarmId && alarms.length > 0) {
      const alarm = alarms.find(a => a.id === parseInt(alarmId));
      if (alarm) {
        // Scroll to the alarm element after a short delay to ensure it's rendered
        setTimeout(() => {
          const element = document.getElementById(`alarm-${alarmId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-amber-500', 'ring-opacity-50');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-amber-500', 'ring-opacity-50');
            }, 3000);
          }
        }, 500);
      }
    }
  }, [alarms]);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || !shiftActive || document.visibilityState !== 'visible') return;
    
    try {
      const lock = await (navigator as any).wakeLock.request('screen');
      setWakeLock(lock);
      
      lock.addEventListener('release', () => {
        setWakeLock(null);
      });
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error(`${err.name}, ${err.message}`);
      } else {
        console.warn('Wake Lock disallowed by permissions policy. Ensure the app is served over HTTPS and the policy allows it.');
      }
    }
  }, [shiftActive]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockRequested) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [wakeLock, wakeLockRequested, requestWakeLock]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    fetch('/api/vehicles')
      .then(res => res.json())
      .then(data => {
        setVehicles(data);
        const storedVehicleId = localStorage.getItem(`rq_vehicle_id_${user.id}`);
        if (storedVehicleId) {
          const v = data.find((v: Vehicle) => v.id === parseInt(storedVehicleId));
          if (v) {
            setSelectedVehicle(v);
          }
        }
      });
  }, [user.id]);

  useEffect(() => {
    const initNotifications = async () => {
      const granted = await requestNotificationPermission();
      if (granted && user.id) {
        await subscribeToPushNotifications(user.id);
      }
    };
    initNotifications();
  }, [user.id]);

  const fetchAlarms = useCallback(async () => {
    try {
      const res = await fetch(`/api/alarms/driver/${user.id}`);
      if (res.ok) {
        setAlarms(await res.json());
      } else {
        console.error('Failed to fetch alarms:', res.statusText);
      }
    } catch (err) {
      console.error('Error fetching alarms:', err);
    }
  }, [user.id]);

  useEffect(() => {
    if (!user.id) return;

    const socket = io();
    socketRef.current = socket;
    
    const setupSocket = () => {
      socket.emit('join', `driver_${user.id}`);
      if (shiftActive) {
        fetchAlarms();
      }
    };

    socket.on('connect', setupSocket);
    
    // Initial setup
    if (socket.connected) {
      setupSocket();
    } else {
      // Fallback if not yet connected
      socket.emit('join', `driver_${user.id}`);
      if (shiftActive) {
        fetchAlarms();
      }
    }

    socket.on('shift_started', () => {
      setShiftActive(true);
      setDeviceShiftConfirmed(true);
      localStorage.setItem(`rq_shift_active_${user.id}`, 'true');
      setWakeLockRequested(true);
    });

    socket.on('shift_ended', () => {
      setShiftActive(false);
      setDeviceShiftConfirmed(false);
      setWakeLockRequested(false);
      localStorage.setItem(`rq_shift_active_${user.id}`, 'false');
      setDriverLocation(null);
    });

    socket.on('vehicles_updated', () => {
      fetch('/api/vehicles')
        .then(res => res.json())
        .then(data => setVehicles(data));
    });

    socket.on('driver_status_updated', (data: { status: 'available' | 'busy' }) => {
      setDriverStatus(data.status);
    });

    socket.on('new_alarm', (alarm: Alarm) => {
      setAlarms(prev => {
        if (prev.some(a => a.id === alarm.id)) return prev;
        return [alarm, ...prev];
      });
      const newNotif = {
        id: Date.now(),
        message: `New dispatch: ${alarm.client_name} at ${alarm.address}`
      };
      setNotifications(prev => [...prev, newNotif]);
      
      showPushNotification(user.id, 'New Dispatch', newNotif.message, 'newDispatch', `/driver?alarmId=${alarm.id}`);
      
      if (ttsEnabledRef.current) {
        speakDispatch(alarm);
      }
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 8000);
    });

    socket.on('alarm_cancelled', (alarmId: number) => {
      setAlarms(prev => prev.filter(a => a.id !== alarmId));
      setActiveAlarm(prev => prev?.id === alarmId ? null : prev);
      const newNotif = {
        id: Date.now(),
        message: `An alarm has been cancelled by the control room.`
      };
      setNotifications(prev => [...prev, newNotif]);
      
      showPushNotification(user.id, 'Alarm Cancelled', newNotif.message, 'statusUpdates');
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 5000);
    });

    socket.on('feedback_response', (data: { feedbackId: number, clientName: string, adminResponse: string }) => {
      const newNotif = {
        id: Date.now(),
        message: `Management response: "${data.adminResponse}" for ${data.clientName}`
      };
      setNotifications(prev => [...prev, newNotif]);
      
      showPushNotification(user.id, 'Incident Response Received', `Management responded to report for ${data.clientName}`, 'statusUpdates');
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 10000);
    });

    socket.on('alarm_status_updated', () => {
      if (shiftActive) {
        fetchAlarms();
      }
    });

    socket.on('driver_status_updated', (data: { status: 'available' | 'busy' }) => {
      setDriverStatus(data.status);
    });

    let watchId: number;
    let heartbeatId: number;

    if (shiftActive && navigator.geolocation) {
      const sendLocation = (position?: GeolocationPosition) => {
        const currentLoc = position ? { lat: position.coords.latitude, lng: position.coords.longitude } : locationRef.current;
        
        if (!currentLoc) return;
        
        if (position) setDriverLocation(currentLoc);

        socket.emit('driver_location_update', {
          driverId: user.id,
          driverName: user.username,
          vehicleId: selectedVehicle?.id,
          isSOS: localStorage.getItem(`rq_driver_sos_${user.id}`) === 'true',
          ...currentLoc
        });
      };

      const handleLocationError = (context: string, error: any) => {
        console.warn(`Gracefully handled: ${context}: ${error.message || error}`);
        
        // If there's no location currently set, let's use the vehicle's position or a default one as fallback
        if (!locationRef.current) {
          const fallbackLoc = selectedVehicle && selectedVehicle.lat && selectedVehicle.lng
            ? { lat: selectedVehicle.lat, lng: selectedVehicle.lng }
            : { lat: -26.2041, lng: 28.0473 }; // Default Johannesburg center
          
          setDriverLocation(fallbackLoc);
          socket.emit('driver_location_update', {
            driverId: user.id,
            driverName: user.username,
            vehicleId: selectedVehicle?.id,
            isSOS: localStorage.getItem(`rq_driver_sos_${user.id}`) === 'true',
            ...fallbackLoc
          });
        }
      };

      navigator.geolocation.getCurrentPosition(
        sendLocation,
        (error) => handleLocationError('Error getting initial location', error),
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
      );

      watchId = navigator.geolocation.watchPosition(
        sendLocation,
        (error) => handleLocationError('Error watching location', error),
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
      );

      // Heartbeat: Send location update every 30s even if stationary
      heartbeatId = window.setInterval(() => {
        sendLocation();
      }, 30000);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (heartbeatId) clearInterval(heartbeatId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user.id, shiftActive, fetchAlarms, selectedVehicle?.id]);

  useEffect(() => {
    localStorage.setItem(`rq_alarms_${user.id}`, JSON.stringify(alarms));
  }, [alarms, user.id]);

  const syncOfflineData = useCallback(async () => {
    if (!navigator.onLine) return;
    
    setIsSyncing(true);
    let needsRefetch = false;
    
    // Sync Feedbacks
    let offlineFeedbacksList = [];
    try {
      offlineFeedbacksList = JSON.parse(localStorage.getItem('rq_offline_feedbacks') || '[]');
    } catch {
      offlineFeedbacksList = [];
    }
    const remainingFeedbacks = [];
    
    for (const fb of offlineFeedbacksList) {
      try {
        const res = await fetch('/api/feedbacks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fb),
        });
        
        if (res.ok) {
          needsRefetch = true;
        } else {
          remainingFeedbacks.push(fb);
        }
      } catch (e) {
        console.error('Failed to sync offline feedback', e);
        remainingFeedbacks.push(fb);
      }
    }
    
    if (remainingFeedbacks.length > 0) {
      localStorage.setItem('rq_offline_feedbacks', JSON.stringify(remainingFeedbacks));
      setOfflineReports(remainingFeedbacks);
    } else {
      localStorage.removeItem('rq_offline_feedbacks');
      setOfflineReports([]);
    }

    // Sync Statuses
    let offlineStatusesList = [];
    try {
      offlineStatusesList = JSON.parse(localStorage.getItem('rq_offline_statuses') || '[]');
    } catch {
      offlineStatusesList = [];
    }
    const remainingStatuses = [];
    
    for (const update of offlineStatusesList) {
      try {
        const res = await fetch(`/api/alarms/${update.alarmId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: update.status })
        });
        
        if (res.ok) {
          needsRefetch = true;
        } else {
          remainingStatuses.push(update);
        }
      } catch (e) {
        console.error('Failed to sync offline status Update', e);
        remainingStatuses.push(update);
      }
    }
    
    if (remainingStatuses.length > 0) {
      localStorage.setItem('rq_offline_statuses', JSON.stringify(remainingStatuses));
      setOfflineStatuses(remainingStatuses);
    } else {
      localStorage.removeItem('rq_offline_statuses');
      setOfflineStatuses([]);
    }

    setIsSyncing(false);

    if (needsRefetch) {
      fetchAlarms();
      const newNotif = {
        id: Date.now(),
        message: 'Offline reports and status synchronized successfully.'
      };
      setNotifications(prev => [...prev, newNotif]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 5000);
      
      // Dispatch update event to refresh other references
      window.dispatchEvent(new CustomEvent('rq_offline_updated'));
    }
  }, [fetchAlarms]);

  useEffect(() => {
    // Initial sync check on mount
    syncOfflineData();

    // Trigger Service Worker IndexedDB sync
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'sync' });
    }

    const handleOnline = () => {
      setIsOffline(false);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'sync' });
      }
      syncOfflineData();
    };
    
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineData]);

  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (!event.data) return;
      
      if (event.data.type === 'RQ_SYNC_COMPLETE') {
        fetchAlarms();
        const newNotif = {
          id: Date.now(),
          message: event.data.message || 'All offline events synchronized with dispatch controllers!'
        };
        setNotifications(prev => [...prev, newNotif]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 5000);
        
        window.dispatchEvent(new CustomEvent('rq_offline_updated'));
      } else if (event.data.type === 'RQ_OFFLINE_QUEUED') {
        const typeLabel = event.data.item?.type === 'feedback' ? 'Incident report' : 'Status change';
        const newNotif = {
          id: Date.now(),
          message: `Network offline. Saved ${typeLabel} to transaction queue.`
        };
        setNotifications(prev => [...prev, newNotif]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 4000);
        
        window.dispatchEvent(new CustomEvent('rq_offline_updated'));
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      if ('SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg) => {
          try {
            (reg as any).sync?.register('rq-sync-queue').catch((err: any) => {
              console.log('Background Sync registration not permitted:', err);
            });
          } catch (e) {
            console.log('Sync register failed gracefully:', e);
          }
        });
      }
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, [fetchAlarms]);

  const updateAlarmStatus = async (alarmId: number, status: string) => {
    // Optimistically update local UI state immediately so it is fast and interactive
    setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, status: status as any } : a));

    const saveStatusToIndexedDBQueue = (id: number, s: string) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('rq-offline-db', 1);
        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('pending-sync')) {
            db.createObjectStore('pending-sync', { keyPath: 'id', autoIncrement: true });
          }
        };
        request.onsuccess = (event: any) => {
          const db = event.target.result;
          try {
            const transaction = db.transaction(['pending-sync'], 'readwrite');
            const store = transaction.objectStore('pending-sync');
            const queueItem = {
              url: `/api/alarms/${id}/status`,
              method: 'POST',
              body: { status: s },
              headers: { 'Content-Type': 'application/json' },
              timestamp: Date.now(),
              type: 'status_update'
            };
            const addReq = store.add(queueItem);
            addReq.onsuccess = () => {
              window.dispatchEvent(new CustomEvent('rq_offline_updated'));
              resolve();
            };
            addReq.onerror = () => reject(addReq.error);
          } catch (err) {
            reject(err);
          }
        };
        request.onerror = (event: any) => reject(request.error);
      });
    };

    try {
      const res = await fetch(`/api/alarms/${alarmId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      const responseData = await res.json().catch(() => ({}));

      if (res && res.ok) {
        if (!responseData.queued) {
          fetchAlarms();
        }
      } else {
        throw new Error('Failed to post status to server');
      }
    } catch (err) {
      console.warn('Network error during status update, queueing in IndexedDB:', err);
      await saveStatusToIndexedDBQueue(alarmId, status).catch(console.error);
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const v = vehicles.find(v => v.id === parseInt(vehicleId));
    if (v) {
      setSelectedVehicle(v);
      localStorage.setItem(`rq_vehicle_id_${user.id}`, vehicleId);
    }
  };

  const handleFeedbackSubmit = () => {
    setActiveAlarm(null);
    setShowConfirmation(true);
    if (navigator.onLine) {
      fetchAlarms();
    } else {
      setAlarms(prev => prev.filter(a => a.id !== activeAlarm?.id));
    }
    setTimeout(() => setShowConfirmation(false), 3000);
  };

  const optimizeRoute = async () => {
    if (!driverLocation || alarms.length < 2) return;
    
    setIsOptimizing(true);
    try {
      // Filter alarms that have coordinates
      const alarmsWithCoords = alarms.filter(a => a.lat && a.lng);
      if (alarmsWithCoords.length < 2) {
        alert("Not enough alarms with valid coordinates to optimize.");
        setIsOptimizing(false);
        return;
      }

      // Format: lon,lat;lon,lat...
      const coords = [
        `${driverLocation.lng},${driverLocation.lat}`,
        ...alarmsWithCoords.map(a => `${a.lng},${a.lat}`)
      ].join(';');

      const response = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=false&source=first`);
      const data = await response.json();

      if (data.code === 'Ok' && data.waypoints) {
        // The waypoints array matches the input coordinates order.
        // waypoints[0] is the driver. waypoints[1...] are the alarms.
        // We need to sort alarmsWithCoords based on their waypoint_index.
        
        const optimizedAlarms = [...alarmsWithCoords].sort((a, b) => {
          const indexA = alarmsWithCoords.indexOf(a) + 1; // +1 because driver is 0
          const indexB = alarmsWithCoords.indexOf(b) + 1;
          
          const wpA = data.waypoints[indexA]?.waypoint_index ?? 999;
          const wpB = data.waypoints[indexB]?.waypoint_index ?? 999;
          
          return wpA - wpB;
        });

        // Append any alarms that didn't have coordinates at the end
        const alarmsWithoutCoords = alarms.filter(a => !a.lat || !a.lng);
        setAlarms([...optimizedAlarms, ...alarmsWithoutCoords]);
        
        // Show success notification
        const newNotif = {
          id: Date.now(),
          message: `Route optimized for ${optimizedAlarms.length} stops.`
        };
        setNotifications(prev => [...prev, newNotif]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 5000);
      } else {
        throw new Error("Failed to optimize route");
      }
    } catch (error) {
      console.error("Error optimizing route:", error);
      alert("Could not optimize route. Please try again later.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleStartShift = async () => {
    try {
      await fetch(`/api/drivers/${user.id}/shift/start`, { method: 'POST' });
      setShiftActive(true);
      setDeviceShiftConfirmed(true);
      localStorage.setItem(`rq_shift_active_${user.id}`, 'true');
      setWakeLockRequested(true);
      
      // Attempt to get wake lock on user gesture
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (err: any) {
          if (err.name !== 'NotAllowedError') {
            console.error('Wake Lock error:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error starting shift:', error);
    }
  };

  const handleEndShift = async () => {
    if (alarms.length > 0) {
      alert("You cannot end your shift while you have active alarms.");
      return;
    }
    try {
      const response = await fetch(`/api/drivers/${user.id}/shift/end`, { method: 'POST' });
      const data = await response.json();
      
      if (data.success && data.summary) {
        setShiftSummary(data.summary);
      } else {
        setShiftSummary({
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMinutes: 0,
          alarmsCompleted: 0,
          distanceCovered: 0
        });
      }
    } catch (error) {
      console.error('Error ending shift:', error);
      alert('Failed to end shift. Please try again.');
    }
  };

  const closeShiftSummaryAndCleanup = () => {
    setShiftActive(false);
    setIsSOS(false);
    localStorage.setItem(`rq_driver_sos_${user.id}`, 'false');
    setDeviceShiftConfirmed(false);
    setWakeLockRequested(false);
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      setWakeLock(null);
    }
    localStorage.setItem(`rq_shift_active_${user.id}`, 'false');
    setDriverLocation(null);
    
    // Notify room of shift ending
    const socket = io();
    socket.emit('driver_shift_end', { driverId: user.id });
    socket.disconnect();
    
    setShiftSummary(null);
  };

  if (activeAlarm) {
    // If the alarm has a specific vehicle assigned by control room, use that one
    // otherwise use the driver's currently selected vehicle
    const alarmVehicle = activeAlarm.vehicle_id 
      ? vehicles.find(v => v.id === activeAlarm.vehicle_id) || selectedVehicle
      : selectedVehicle;

    return (
      <FeedbackForm 
        alarm={activeAlarm} 
        user={user} 
        vehicle={alarmVehicle!} 
        onComplete={handleFeedbackSubmit}
        onCancel={() => setActiveAlarm(null)}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-full relative px-4 pb-6">
      <header className="bg-white text-slate-900 px-4 py-3 shadow-sm border-b border-slate-200 flex justify-between items-center -mx-4 mb-4 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Logo size="xs" />
          <span className={`font-bold tracking-tight px-2 py-0.5 rounded border uppercase text-[10px] ${
            shiftActive 
              ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
              : 'text-rq-gold bg-rq-gold/10 border-rq-gold/20'
          }`}>
            {shiftActive ? 'Active Shift' : 'Operations'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTtsEnabled(prev => !prev)}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              ttsEnabled ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={ttsEnabled ? "Disable Voice Dispatch Announcements" : "Enable Voice Dispatch Announcements"}
          >
            {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={onLogout}
            disabled={shiftActive}
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
              shiftActive 
                ? 'text-slate-300 cursor-not-allowed' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title={shiftActive ? "End shift to logout" : "Logout"}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {showSettings && <ProfileSettings isOpen={showSettings} onClose={() => setShowSettings(false)} user={user} />}

      {isOffline && (
        <div className="bg-slate-800 text-white p-3 rounded-xl shadow-lg flex items-center justify-between mb-4 sticky top-4 z-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-500" size={20} />
            <div>
              <p className="font-bold text-sm">Offline Mode Active</p>
              <p className="text-xs text-slate-300">Viewing saved alarms. Actions will sync when connection returns.</p>
            </div>
          </div>
        </div>
      )}

      {/* Offline Data Queue Indicator & Sync Panel */}
      {(offlineReports.length > 0 || offlineStatuses.length > 0 || indexedDBQueue.length > 0) && (
        <div id="offline-sync-queue-panel" className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 mb-5 shadow-sm animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3 ml-0 mr-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                <Activity size={18} className="animate-pulse text-amber-500" />
              </div>
              <div className="text-left">
                <h4 className="font-extrabold text-slate-900 text-sm">Active Sync Queue</h4>
                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                  {offlineReports.length + offlineStatuses.length + indexedDBQueue.length} item(s) pending network connection
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                if (!navigator.onLine) {
                  const newNotif = {
                    id: Date.now(),
                    message: "Device is still offline. Re-connect to sync queue."
                  };
                  setNotifications(prev => [...prev, newNotif]);
                  setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNotif.id)), 3000);
                } else {
                  // Direct trigger of local storage queue sync and posting sync to Service Worker
                  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ action: 'sync' });
                  }
                  syncOfflineData();
                }
              }}
              disabled={isSyncing}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                isSyncing 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 cursor-pointer'
              }`}
            >
              {isSyncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17m0 0V4"></path>
                  </svg>
                  Force Sync Now
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {/* Status Updates Queue */}
            {offlineStatuses.map((stat, i) => (
              <div key={`stat-${i}`} className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 text-left">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800">Status Update: </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 font-black text-slate-700 uppercase">
                      {stat.status}
                    </span>
                    <span className="text-slate-400 font-mono ml-2">#Case {stat.alarmId}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                  Pending Status
                </span>
              </div>
            ))}

            {/* Offline Feedback Reports Queue */}
            {offlineReports.map((report, i) => (
              <div key={`rep-${i}`} className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 text-left">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800">Incident: </span>
                    <span className="text-slate-600 font-medium">{report.client_name}</span>
                    <span className="text-slate-400 ml-1 text-[11px] truncate hidden sm:inline">({report.address})</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded border border-rose-100 animate-pulse whitespace-nowrap">
                  Queued Report
                </span>
              </div>
            ))}

            {/* Service Worker Queued Items from IndexedDB */}
            {indexedDBQueue.map((item, i) => {
              const isFeedback = item.type === 'feedback';
              const name = isFeedback ? (item.body.client_name || 'Incident Sync') : `Case #${item.url.split('/')[3] || 'Update'}`;
              return (
                <div key={`idb-${i}`} className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex justify-between items-center text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 text-left">
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${isFeedback ? 'bg-indigo-500' : 'bg-pink-500'}`} />
                    <div className="truncate">
                      <span className="font-bold text-slate-800">{isFeedback ? 'Report (SW): ' : 'Status (SW): '}</span>
                      <span className="text-slate-600 font-medium">
                        {isFeedback ? name : `Update to ${item.body.status || 'Next'}`}
                      </span>
                      {!isFeedback && <span className="text-slate-400 font-mono ml-2">{name}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-100 whitespace-nowrap ${isFeedback ? 'text-indigo-600 border-indigo-100 animate-pulse' : 'text-pink-600 border-pink-100 animate-pulse'}`}>
                    SW Queued
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {showInstallBanner && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-slideIn mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rq-gold rounded-lg flex items-center justify-center">
              <Smartphone size={20} className="text-slate-900" />
            </div>
            <div>
              <p className="font-bold text-sm">Install RQ Operations</p>
              <p className="text-xs text-slate-400">Add to home screen for background alerts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowInstallBanner(false)} className="text-xs text-slate-400 px-2">Later</button>
            <button onClick={handleInstallClick} className="bg-rq-gold hover:bg-amber-500 text-slate-900 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Install</button>
          </div>
        </div>
      )}

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 gap-1 mt-2 mb-6">
        <button
          onClick={() => setActiveTab('dispatches')}
          className={`flex-1 py-2.5 rounded-lg text-center font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'dispatches'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity size={15} />
          Dispatches & Duty
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex-1 py-2.5 rounded-lg text-center font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={15} />
          Performance Telemetry
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-center font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={15} />
          History Log
        </button>
      </div>

      {activeTab === 'performance' ? (
        <DriverPerformance user={user} />
      ) : activeTab === 'history' ? (
        <DriverHistory user={user} />
      ) : (
        <>
          {/* Shift Control Panel - Unified */}
          {!shiftActive ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-rq-gold/10 text-rq-gold rounded-full flex items-center justify-center mx-auto mb-4">
            <Car size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Shift Inactive</h2>
          <p className="text-slate-500 mt-2 mb-8 max-w-sm mx-auto">Select a vehicle and start your shift to begin receiving dispatches and tracking location.</p>
          
          <div className="max-w-xs mx-auto space-y-4">
            <div className="text-left">
              <label className="block text-sm font-medium text-slate-700 mb-2">Assign Vehicle</label>
              <select
                onChange={(e) => handleVehicleSelect(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none text-slate-700 bg-slate-50"
                value={selectedVehicle?.id || ""}
              >
                <option value="" disabled>Select a vehicle...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.registration}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleStartShift}
              disabled={!selectedVehicle}
              className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                selectedVehicle 
                  ? 'bg-rq-dark text-white hover:bg-slate-800 shadow-md hover:shadow-lg' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 size={24} />
              Start Shift
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Notifications Container */}
          <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
            {notifications.map(notif => (
              <div key={notif.id} className="bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideIn">
                <Bell size={18} />
                <span className="text-sm font-medium">{notif.message}</span>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                  className="ml-2 text-amber-100 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          {showConfirmation && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 bg-rq-gold text-slate-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-[bounce_1s_ease-in-out] z-50">
              <CheckCircle2 size={20} className="text-slate-900" />
              <span className="font-medium">Feedback submitted successfully!</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Active Shift</h2>
              <p className="text-slate-500 mt-1 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${alarms.length > 0 ? 'bg-amber-500' : driverStatus === 'busy' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></span>
                {alarms.length > 0 ? 'Status: Dispatched' : driverStatus === 'busy' ? 'Status: Busy (No new dispatches)' : 'Awaiting dispatch'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {'wakeLock' in navigator && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  <div className={`w-2 h-2 rounded-full ${wakeLock ? 'bg-rq-gold shadow-[0_0_8px_rgba(226,214,112,0.5)]' : 'bg-slate-300'}`}></div>
                  <span className="text-xs font-medium text-slate-600">Screen Awake</span>
                  {!wakeLock && shiftActive && (
                    <button 
                      onClick={() => {
                        setWakeLockRequested(true);
                        requestWakeLock();
                      }}
                      className="text-[10px] bg-rq-gold/20 text-rq-gold px-1.5 py-0.5 rounded hover:bg-rq-gold/30 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
              {selectedVehicle && (
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                  <Car className="text-slate-400" size={20} />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Vehicle</p>
                    <p className="font-bold text-slate-800">{selectedVehicle.registration}</p>
                  </div>
                </div>
              )}
              <button 
                onClick={handleSOSToggle}
                className={`w-full sm:w-auto px-5 py-2 rounded-lg font-black transition-all border flex items-center justify-center gap-2 shadow-sm uppercase text-sm cursor-pointer ${
                  isSOS 
                    ? 'bg-red-600 text-white border-red-500 animate-pulse ring-4 ring-red-300' 
                    : 'bg-red-500 hover:bg-red-600 text-white border-red-600'
                }`}
                title="Trigger System-Wide High-Priority SOS Emergency Alert"
              >
                <AlertTriangle size={18} className={isSOS ? 'animate-[bounce_0.8s_infinite]' : ''} />
                <span>{isSOS ? 'SOS Active' : 'Trigger SOS'}</span>
              </button>
              <button 
                onClick={handleEndShift}
                className="w-full sm:w-auto bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-medium transition-colors border border-red-100 cursor-pointer text-sm"
              >
                End Shift
              </button>
            </div>
          </div>

          {isSOS && (
            <div className="bg-red-600 border-2 border-red-500 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-pulse mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white text-red-600 rounded-full animate-bounce">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-wider">⚠️ EMERGENCY SOS ACTIVE</h3>
                  <p className="text-xs text-red-100 mt-0.5">Your exact GPS coordinates are live and broadcasted in red to the Control Room.</p>
                </div>
              </div>
              <button 
                onClick={handleSOSToggle}
                className="bg-white text-red-600 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-slate-100 shadow cursor-pointer uppercase"
              >
                Cancel SOS
              </button>
            </div>
          )}

          <DriverAlarmMap alarms={alarms} driverLocation={driverLocation} etas={etas} />

          <div className="flex items-center justify-between mb-4 mt-8">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="text-amber-500" />
              Dispatched Alarms ({alarms.length})
            </h3>
            {alarms.length > 1 && (
              <button
                onClick={optimizeRoute}
                disabled={isOptimizing || !driverLocation}
                className="bg-rq-gold/20 text-rq-gold hover:bg-rq-gold/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOptimizing ? (
                  <span className="w-4 h-4 border-2 border-rq-gold border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <MapPin size={16} />
                )}
                Optimize Route
              </button>
            )}
          </div>

          <div className="space-y-4">
            {alarms.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell size={24} />
                </div>
                <p className="text-slate-500 font-medium">No active dispatches</p>
                <p className="text-slate-400 text-sm">You will be notified when a new alarm is assigned to you.</p>
              </div>
            ) : (
              alarms.map(alarm => (
                <div key={alarm.id} id={`alarm-${alarm.id}`} className="bg-white border-l-4 border-amber-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                          {alarm.alarm_type || 'Alarm'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          alarm.status === 'en_route' ? 'bg-blue-100 text-blue-800' :
                          alarm.status === 'arrived' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {alarm.status.replace('_', ' ')}
                        </span>
                        <button
                          onClick={() => speakDispatch(alarm)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors border border-sky-100 ml-1 cursor-pointer"
                          title="Listen to details"
                        >
                          <Volume2 size={10} />
                          Speak
                        </button>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xl">{alarm.client_name}</h4>
                      <p className="text-slate-600 flex items-center gap-1.5 mt-1.5">
                        <MapPin size={16} className="text-slate-400" />
                        {alarm.address}
                      </p>
                      {etas[alarm.id] && alarm.status !== 'arrived' && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold border border-amber-100">
                            <Clock size={14} />
                            {Math.ceil(etas[alarm.id].duration / 60)} min
                          </span>
                          <span className="flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-0.5 rounded text-xs font-medium border border-slate-100">
                            <Car size={14} />
                            {(etas[alarm.id].distance / 1000).toFixed(1)} km
                          </span>
                        </div>
                      )}
                      {alarm.vehicle_registration && (
                        <p className="text-blue-600 flex items-center gap-1.5 mt-1 text-sm font-medium">
                          <Car size={16} className="text-blue-400" />
                          Assigned Vehicle: {alarm.vehicle_registration}
                        </p>
                      )}
                      {alarm.incident_details && (
                        <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900 block mb-1">Incident Details:</span>
                          {alarm.incident_details}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                      <Clock size={12} />
                      {new Date(alarm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    {alarm.status === 'dispatched' && (
                      <button
                        onClick={() => updateAlarmStatus(alarm.id, 'en_route')}
                        className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Car size={18} />
                        En Route
                      </button>
                    )}
                    {alarm.status === 'en_route' && (
                      <button
                        onClick={() => updateAlarmStatus(alarm.id, 'arrived')}
                        className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <MapPin size={18} />
                        Arrived
                      </button>
                    )}
                    <button
                      onClick={() => setActiveAlarm(alarm)}
                      className={`flex-1 ${alarm.status === 'arrived' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'} text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2`}
                    >
                      <CheckCircle2 size={18} />
                      Submit Report
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
        </>
      )}

      {shiftSummary && (
        <div id="shift-summary-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center uppercase">Shift Completed</h2>
            <p className="text-sm text-slate-500 text-center mt-1 mb-6">Thank you for your service! Here's your duty report:</p>
            
            <div className="grid grid-cols-1 gap-3 w-full mb-6">
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Clock size={20} />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Shift Duration</span>
                  <span className="text-lg font-bold text-slate-900">
                    {Math.floor(shiftSummary.durationMinutes / 60) > 0 
                      ? `${Math.floor(shiftSummary.durationMinutes / 60)}h ${shiftSummary.durationMinutes % 60}m` 
                      : `${shiftSummary.durationMinutes} min`}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Alarms Completed</span>
                  <span className="text-lg font-bold text-slate-900">
                    {shiftSummary.alarmsCompleted} {shiftSummary.alarmsCompleted === 1 ? 'Alarm' : 'Alarms'}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Car size={20} />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Distance Covered</span>
                  <span className="text-lg font-bold text-slate-900">
                    {shiftSummary.distanceCovered.toFixed(2)} km
                  </span>
                </div>
              </div>
            </div>
            
            <div className="w-full text-center mb-6 font-mono text-[10px] text-slate-400 bg-slate-50 py-2.5 rounded-xl border border-dashed border-slate-200">
              <div className="flex justify-between px-3 mb-1">
                <span>START TIME:</span>
                <span className="font-bold text-slate-600">
                  {shiftSummary.startTime ? new Date(shiftSummary.startTime.replace(' ', 'T') + 'Z').toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between px-3">
                <span>END TIME:</span>
                <span className="font-bold text-slate-600">
                  {shiftSummary.endTime ? new Date(shiftSummary.endTime.replace(' ', 'T') + 'Z').toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                </span>
              </div>
            </div>
            
            <button
              onClick={closeShiftSummaryAndCleanup}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all transform hover:scale-[1.01] active:scale-95 text-center uppercase tracking-wider text-sm cursor-pointer"
            >
              Close Summary & Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
