import React, { useState, useEffect, useCallback } from 'react';
import { Vehicle, User, Alarm, Feedback, Client, NotificationSettings, ActivityLog } from '../types';
import { Plus, Car, ShieldCheck, Users, AlertTriangle, MapPin, Clock, CheckCircle2, X, UserPlus, Trash2, Bell, Map as MapIcon, Search, Filter, User as UserIcon, Edit2, LogOut, Settings as SettingsIcon, Building2, Phone, MessageSquare, Send, Key, Database, Monitor, Smartphone, Sparkles, Download, RefreshCw, FileText } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete';
import { io } from 'socket.io-client';
import DriverMap from './DriverMap';
import Logo from './Logo';
import PhoneContainer from './PhoneContainer';
import { requestNotificationPermission, showPushNotification } from '../utils/notifications';
import { hasPermission } from '../utils/permissions';

interface Props {
  user: User;
  onLogout: () => void;
  viewMode?: 'computer' | 'phone';
  onViewModeChange?: (mode: 'computer' | 'phone') => void;
}

export default function AdminDashboard({ user, onLogout, viewMode: propViewMode, onViewModeChange }: Props) {
  const [localViewMode, setLocalViewMode] = useState<'computer' | 'phone'>('computer');
  const viewMode = propViewMode || localViewMode;
  const setViewMode = onViewModeChange || setLocalViewMode;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [reports, setReports] = useState<Feedback[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'dispatch' | 'map' | 'reports' | 'vehicles' | 'users' | 'clients' | 'settings' | 'logs'>('map');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsFilterAction, setLogsFilterAction] = useState<string>('all');
  const [notifications, setNotifications] = useState<{id: number, message: string, type?: 'info' | 'critical' | 'sos'}[]>([]);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem(`notif_settings_${user.id}`);
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      newDispatches: true,
      statusUpdates: true,
      feedbacks: true
    };
  });
  const [driverLocations, setDriverLocations] = useState<Record<number, any>>({});
  const [selectedAlarmId, setSelectedAlarmId] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab !== 'map') {
      setSelectedAlarmId(null);
    }
  }, [activeTab]);

  const [newVehicle, setNewVehicle] = useState('');
  const [newVehicleColor, setNewVehicleColor] = useState('#64748b');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [newAlarm, setNewAlarm] = useState({ client_name: '', address: '', assigned_driver_id: '', vehicle_id: '', alarm_type: 'Alarm', incident_details: '', priority: 'medium', lat: undefined as number | undefined, lng: undefined as number | undefined });
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'driver', pin: '' });
  const [userSearch, setUserSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [assigningAlarm, setAssigningAlarm] = useState<Alarm | null>(null);
  const [assignmentData, setAssignmentData] = useState({ driverId: '', vehicleId: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'dispatched' | 'completed' | 'cancelled'>('all');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Telegram Bot Integration State
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramNotifySOS, setTelegramNotifySOS] = useState(true);
  const [telegramNotifyAlarms, setTelegramNotifyAlarms] = useState(true);
  const [telegramStatus, setTelegramStatus] = useState('Checking...');
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);

  // Shift Summary Generator State
  const [selectedReportDate, setSelectedReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryReport, setSummaryReport] = useState<any>(null);
  const [activeSummaryTab, setActiveSummaryTab] = useState<'summary' | 'alarms' | 'shifts' | 'fleet'>('summary');
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const handleGenerateShiftSummary = async () => {
    setIsGeneratingSummary(true);
    setSummaryReport(null);
    setShowSummaryModal(true);
    try {
      const res = await fetch(`/api/reports/shift-summary?date=${selectedReportDate}`);
      if (res.ok) {
        const data = await res.json();
        setSummaryReport(data);
        setActiveSummaryTab('summary');
      } else {
        const err = await res.json();
        console.error('Error generating summary:', err);
        alert(err.error || 'Failed to generate report');
        setShowSummaryModal(false);
      }
    } catch (e) {
      console.error('Network error generating summary:', e);
      alert('Network error generating report');
      setShowSummaryModal(false);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleDownloadHTMLReport = () => {
    if (!summaryReport) return;
    
    const { summary, metrics, alarms, feedbacks, shifts, vehicles, date, isFallback } = summaryReport;
    
    // Clean up Markdown formatting for display in HTML report
    const cleanSummaryHtml = summary
      .replace(/\r\n/g, '\n')
      .split('\n\n')
      .map((p: string) => {
        if (p.startsWith('### ')) {
          return `<h3 class="text-base font-bold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1">${p.substring(4)}</h3>`;
        }
        if (p.startsWith('## ')) {
          return `<h2 class="text-lg font-black text-slate-900 mt-8 mb-3">${p.substring(3)}</h2>`;
        }
        if (p.startsWith('- ') || p.startsWith('* ')) {
          const listItems = p.split('\n').map((item: string) => {
            const cleanItem = item.replace(/^[-*]\s+/, '').replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
            return `<li class="ml-4 list-disc text-sm text-slate-600 mb-1">${cleanItem}</li>`;
          }).join('');
          return `<ul class="my-3">${listItems}</ul>`;
        }
        const boldP = p.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
        return `<p class="mb-4 text-slate-700 leading-relaxed text-sm">${boldP}</p>`;
      })
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RQ Response Security Fleet - Shift Summary Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { background-color: #ffffff; color: #000000; padding: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .shadow-lg { box-shadow: none !important; }
      .border { border-color: #e2e8f0 !important; }
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen text-slate-800 font-sans py-10 px-4 md:px-8">
  <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
    <!-- Header -->
    <div class="bg-slate-900 text-white p-8 border-b border-slate-800 relative">
      <div class="flex justify-between items-start">
        <div>
          <span class="text-[10px] uppercase font-mono tracking-widest text-amber-400 bg-amber-950 px-2.5 py-1 rounded font-bold">
            RQ RESPONSE SECURITY FLEET
          </span>
          <h1 class="text-2xl font-black mt-3">Shift Operations & Telemetry Report</h1>
          <p class="text-slate-400 text-sm mt-1">Generated: ${new Date().toLocaleString()}</p>
        </div>
        <div class="text-right">
          <div class="text-xs text-slate-400 font-mono">REPORTING DATE</div>
          <div class="text-lg font-bold text-white font-mono mt-0.5">${date}</div>
          ${isFallback ? '<div class="text-[10px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded mt-2 inline-block font-mono">Fallback Data</div>' : ''}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="p-8 space-y-8">
      
      <!-- Metrics Bento Grid -->
      <div>
        <h2 class="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">Key Shift Metrics</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-xs text-slate-500 font-medium">Total Alarms</div>
            <div class="text-2xl font-black text-slate-900 mt-1">${metrics.totalAlarms}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-xs text-slate-500 font-medium">Resolved (Completed)</div>
            <div class="text-2xl font-black text-emerald-600 mt-1">${metrics.completedAlarms}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-xs text-slate-500 font-medium">Distance Covered</div>
            <div class="text-2xl font-black text-blue-600 mt-1">${(metrics.totalDistance || 0).toFixed(1)} km</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-xs text-slate-500 font-medium">Active Drivers</div>
            <div class="text-2xl font-black text-slate-900 mt-1">${metrics.activeDrivers}</div>
          </div>
        </div>
      </div>

      <!-- AI Executive Summary -->
      <div class="bg-slate-50 border border-slate-200/60 rounded-2xl p-6">
        <h2 class="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
          <span class="p-1 rounded bg-amber-100 text-amber-700">✨</span>
          Executive Operations Analysis
        </h2>
        <div class="prose max-w-none text-slate-700">
          ${cleanSummaryHtml}
        </div>
      </div>

      <!-- Incident Log Table -->
      <div class="page-break">
        <h2 class="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">Incident Dispatch Log (${alarms.length})</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <th class="px-4 py-3">ID</th>
                <th class="px-4 py-3">Client & Address</th>
                <th class="px-4 py-3">Priority</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3">Driver</th>
                <th class="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${alarms.map((a: any) => `
                <tr class="hover:bg-slate-50/50">
                  <td class="px-4 py-3.5 font-mono text-xs">#${a.id}</td>
                  <td class="px-4 py-3.5">
                    <div class="font-bold text-slate-900">${a.client_name}</div>
                    <div class="text-slate-500 text-xs mt-0.5">${a.address}</div>
                  </td>
                  <td class="px-4 py-3.5">
                    <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      a.priority === 'critical' ? 'bg-red-50 text-red-700 border border-red-100' :
                      a.priority === 'high' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-slate-50 text-slate-500'
                    }">${a.priority || 'medium'}</span>
                  </td>
                  <td class="px-4 py-3.5 text-xs font-semibold text-slate-700">${a.alarm_type || 'Alarm'}</td>
                  <td class="px-4 py-3.5 text-xs text-slate-600">${a.driver_name || 'Unassigned'}</td>
                  <td class="px-4 py-3.5">
                    <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      a.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      a.status === 'pending' ? 'bg-red-50 text-red-700' :
                      'bg-blue-50 text-blue-700'
                    }">${a.status}</span>
                  </td>
                </tr>
              `).join('')}
              ${alarms.length === 0 ? '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No alarms recorded</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Driver Shift Table -->
      <div class="page-break mt-8">
        <h2 class="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">Driver Shifts & Telemetry</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <th class="px-4 py-3">Driver Name</th>
                <th class="px-4 py-3">Shift Start</th>
                <th class="px-4 py-3">Shift End</th>
                <th class="px-4 py-3">Distance covered</th>
                <th class="px-4 py-3">Alarms Resolved</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${shifts.map((s: any) => `
                <tr class="hover:bg-slate-50/50">
                  <td class="px-4 py-3.5 font-bold text-slate-900">${s.driver_name}</td>
                  <td class="px-4 py-3.5 text-xs text-slate-500 font-mono">${new Date(s.start_time).toLocaleString()}</td>
                  <td class="px-4 py-3.5 text-xs font-mono">${s.end_time ? new Date(s.end_time).toLocaleString() : '<span class="text-emerald-600 font-bold">ACTIVE SHIFT</span>'}</td>
                  <td class="px-4 py-3.5 text-xs font-mono font-bold">${(s.distance_covered || 0).toFixed(1)} km</td>
                  <td class="px-4 py-3.5 font-semibold text-slate-700">${s.alarms_completed || 0}</td>
                </tr>
              `).join('')}
              ${shifts.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">No shifts recorded</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Fleet Status Table -->
      <div class="page-break mt-8">
        <h2 class="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">Fleet Status & Telemetry</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <th class="px-4 py-3">Vehicle</th>
                <th class="px-4 py-3">Registration</th>
                <th class="px-4 py-3">Last Coordinates</th>
                <th class="px-4 py-3">Duty Assignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${vehicles.map((v: any) => `
                <tr class="hover:bg-slate-50/50">
                  <td class="px-4 py-3.5 flex items-center gap-3">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${v.color || '#64748b'}"></span>
                    <span class="font-bold text-slate-800">RQ Response Unit</span>
                  </td>
                  <td class="px-4 py-3.5 font-mono text-xs font-bold text-slate-900">${v.registration}</td>
                  <td class="px-4 py-3.5 font-mono text-xs text-slate-500">${v.lat ? `${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}` : 'Offline / No GPS'}</td>
                  <td class="px-4 py-3.5 text-xs">
                    ${v.active_driver ? `<span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">Assigned: ${v.active_driver}</span>` : '<span class="text-slate-400">Available</span>'}
                  </td>
                </tr>
              `).join('')}
              ${vehicles.length === 0 ? '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400">No vehicles recorded</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div class="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center no-print">
      <button onclick="window.print()" class="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all shadow">
        Print Report
      </button>
      <span class="text-xs text-slate-400 font-mono">Confidential • Internal Operations Only</span>
    </div>
  </div>
</body>
</html>
`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RQ_Shift_Summary_${date}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdownReport = () => {
    if (!summaryReport) return;
    const { summary, metrics, date, isFallback } = summaryReport;
    
    const mdContent = `# RQ Response Security Fleet - Shift Operations Report
Reporting Date: ${date} ${isFallback ? '(Simulation/Sample Fallback Data)' : ''}
Generated At: ${new Date().toLocaleString()}

## 📊 SHIFT METRICS
- Total Alarms Dispatched: ${metrics.totalAlarms}
- Alarms Completed/Resolved: ${metrics.completedAlarms}
- Distance Covered by Fleet: ${(metrics.totalDistance || 0).toFixed(1)} km
- Active Responders on Duty: ${metrics.activeDrivers}

## 🤖 AI OPERATIONAL EXECUTIVE SUMMARY
${summary}

---
Confidential • RQ Response Security Fleet Internal Operations Only
`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RQ_Shift_Summary_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Fetch Telegram Config from server
  const fetchTelegramConfig = async () => {
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) {
        const data = await res.json();
        setTelegramToken(data.telegram_token || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setTelegramEnabled(data.telegram_enabled || false);
        setTelegramNotifySOS(data.telegram_notify_sos !== false);
        setTelegramNotifyAlarms(data.telegram_notify_alarms !== false);
        setTelegramStatus(data.telegram_status || 'Inactive');
      }
    } catch (e) {
      console.error('Error fetching telegram config:', e);
    }
  };

  // Save Telegram Config coordinates
  const saveTelegramConfig = async () => {
    setIsSavingTelegram(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramToken,
          chat_id: telegramChatId,
          enabled: telegramEnabled,
          notify_sos: telegramNotifySOS,
          notify_alarms: telegramNotifyAlarms
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus(data.status || 'Active (Polling...)');
        alert('Telegram integration settings updated and saved successfully.');
        fetchTelegramConfig(); // refresh to get masked tokens
      } else {
        const data = await res.json();
        alert(`Failed to save settings: ${data.error || 'Unknown Error'}`);
      }
    } catch (e: any) {
      alert(`Error saving telegram configuration: ${e.message}`);
    } finally {
      setIsSavingTelegram(false);
    }
  };

  // Test send message directly
  const testTelegramIntegration = async () => {
    setTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramToken,
          chat_id: telegramChatId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramTestResult({ success: true });
        setTimeout(() => setTelegramTestResult(null), 4000);
      } else {
        setTelegramTestResult({ success: false, error: data.error || 'Failed to send telegram test message' });
      }
    } catch (e: any) {
      setTelegramTestResult({ success: false, error: e.message || 'Network request failed' });
    } finally {
      setTestingTelegram(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchTelegramConfig();
    }
  }, [activeTab]);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [newClient, setNewClient] = useState({ name: '', address: '', phone: '', lat: undefined as number | undefined, lng: undefined as number | undefined });

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    fetchData();

    const socket = io();
    
    const setupSocket = () => {
      socket.emit('join', 'control_room');
      fetchData();
    };

    socket.on('connect', setupSocket);
    
    // Initial setup
    if (socket.connected) {
      setupSocket();
    } else {
      // Fallback if not yet connected
      socket.emit('join', 'control_room');
    }

    socket.on('alarms_updated', () => {
      fetchData();
    });

    socket.on('users_updated', () => {
      fetchData();
    });

    socket.on('vehicles_updated', () => {
      fetchData();
    });

    socket.on('activity_logs_updated', () => {
      fetchActivityLogs();
    });

    socket.on('alarm_status_updated', (data: { message: string }) => {
      fetchData();
      if (notifSettings.statusUpdates) {
        const newNotif = {
          id: Date.now(),
          message: data.message
        };
        setNotifications(prev => [...prev, newNotif]);
        if (notifSettings.soundEnabled) playNotificationSound();
        
        showPushNotification(user.id, 'Status Update', newNotif.message, 'statusUpdates');
        
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
        }, 5000);
      }
    });

    socket.on('new_feedback', (data: { client_name: string, address: string }) => {
      fetchData();
      if (notifSettings.feedbacks) {
        const newNotif = {
          id: Date.now(),
          message: `New feedback submitted for ${data.client_name} at ${data.address}`
        };
        setNotifications(prev => [...prev, newNotif]);
        if (notifSettings.soundEnabled) playNotificationSound();
        
        showPushNotification(user.id, 'Alarm Resolved', newNotif.message, 'feedback');
        
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
        }, 5000);
      }
    });

    socket.on('driver_location_update', (data: { driverId: number, driverName: string, vehicleId?: number, lat: number, lng: number, lastUpdated?: number, history?: any[], isOffline?: boolean }) => {
      setDriverLocations(prev => ({
        ...prev,
        [data.driverId]: {
          ...data,
          lastUpdated: data.lastUpdated || Date.now(),
          history: data.history || prev[data.driverId]?.history || [],
          isOffline: data.isOffline || false
        }
      }));
      
      // Update vehicle location in the local state if vehicleId is present
      if (data.vehicleId && data.lat && data.lng) {
        setVehicles(prev => prev.map(v => 
          v.id === data.vehicleId ? { ...v, lat: data.lat, lng: data.lng } : v
        ));
      }
    });

    socket.on('driver_offline', (data: { driverId: number, driverName: string, lastUpdated: number }) => {
      setDriverLocations(prev => {
        if (!prev[data.driverId]) return prev;
        return {
          ...prev,
          [data.driverId]: {
            ...prev[data.driverId],
            isOffline: true
          }
        };
      });

      const newNotif: {id: number, message: string, type: 'critical'} = {
        id: Date.now(),
        message: `⚠️ Driver ${data.driverName} has been offline for more than 2 minutes.`,
        type: 'critical'
      };
      setNotifications(prev => [...prev, newNotif]);
      
      showPushNotification(user.id, 'Driver Offline', newNotif.message, 'statusUpdates');
      
      // Critical notifications stay longer
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 15000);
    });

    socket.on('driver_shift_end', (driverId: number) => {
      setDriverLocations(prev => {
        const newLocations = { ...prev };
        delete newLocations[driverId];
        return newLocations;
      });
      fetchData();
    });

    socket.on('driver_shift_started', () => {
      fetchData();
    });

    socket.on('driver_shift_ended', () => {
      fetchData();
    });

    socket.on('driver_status_updated', () => {
      fetchData();
    });

    socket.on('system_sos_alert', (data: { driverId: number, driverName: string, isSOS: boolean }) => {
      if (data.isSOS) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
          audio.volume = 0.8;
          audio.play().catch(() => {});
        } catch (e) {
          console.warn('Audio play failed', e);
        }

        const newNotif = {
          id: Date.now(),
          message: `🚨 HIGH-PRIORITY SOS: Driver ${data.driverName} has requested emergency assistance!`,
          type: 'sos' as const
        };
        setNotifications(prev => [newNotif, ...prev]);

        showPushNotification(user.id, `🚨 SOS FROM ${data.driverName.toUpperCase()}`, `Emergency assistance requested immediately!`, 'statusUpdates');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const updateLastActive = () => {
      localStorage.setItem(`rq_dispatch_last_active_${user.id}`, Date.now().toString());
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateLastActive));
    
    // Initial update
    updateLastActive();

    return () => {
      events.forEach(event => window.removeEventListener(event, updateLastActive));
    };
  }, [user.id]);

  useEffect(() => {
    const handleClickOutside = () => setShowClientSuggestions(false);
    if (showClientSuggestions) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showClientSuggestions]);

  useEffect(() => {
    localStorage.setItem(`notif_settings_${user.id}`, JSON.stringify(notifSettings));
  }, [notifSettings, user.id]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Handle browser audio blocking
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };

  const fetchData = async (retries = 3) => {
    try {
      // First, ensure we can reach the health endpoint
      const healthRes = await fetch('/health').catch(() => null);
      if (!healthRes || !healthRes.ok) {
        if (retries > 0) {
          console.warn(`Server not ready, retrying... (${retries} attempts left)`);
          setTimeout(() => fetchData(retries - 1), 1000);
          return;
        }
      }

      const results = await Promise.allSettled([
        fetch('/api/vehicles').then(r => r.ok ? r.json() : Promise.reject('Vehicles failed')),
        fetch('/api/drivers').then(r => r.ok ? r.json() : Promise.reject('Drivers failed')),
        fetch('/api/alarms').then(r => r.ok ? r.json() : Promise.reject('Alarms failed')),
        fetch(`/api/reports?requesterId=${user.id}`).then(r => r.ok ? r.json() : Promise.reject('Reports failed')),
        fetch('/api/users').then(r => r.ok ? r.json() : Promise.reject('Users failed')),
        fetch('/api/clients').then(r => r.ok ? r.json() : Promise.reject('Clients failed'))
      ]);
      
      results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
          switch(index) {
            case 0: setVehicles(res.value); break;
            case 1: setDrivers(res.value); break;
            case 2: setAlarms(res.value); break;
            case 3: setReports(res.value); break;
            case 4: setAllUsers(res.value); break;
            case 5: setClients(res.value); break;
          }
        } else {
          console.error(`Endpoint ${index} failed:`, res.reason);
        }
      });
    } catch (error) {
      console.error('Error in fetchData:', error);
      if (retries > 0) {
        setTimeout(() => fetchData(retries - 1), 2000);
      }
    }
  };

  const fetchActivityLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/activity-logs');
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch activity logs:', e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchActivityLogs();
    }
  }, [activeTab]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle) return;
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration: newVehicle, color: newVehicleColor })
    });
    if (res.ok) {
      setNewVehicle('');
      setNewVehicleColor('#64748b');
      fetchData();
    }
  };

  const handleEditVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle || !editingVehicle.registration) return;
    const res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration: editingVehicle.registration, color: editingVehicle.color })
    });
    if (res.ok) {
      setEditingVehicle(null);
      fetchData();
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    const res = await fetch(`/api/vehicles/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission(user, 'manage_all_users') && !hasPermission(user, 'manage_drivers')) {
      alert('You do not have permission to create users.');
      return;
    }
    if (!newUser.username || !newUser.password) return;
    if (newUser.role === 'driver' && (!newUser.pin || newUser.pin.length !== 4)) {
      alert('Drivers must have a 4-digit PIN.');
      return;
    }
    if (newUser.role !== 'driver' && !hasPermission(user, 'manage_all_users')) {
      alert('You only have permission to create driver accounts.');
      return;
    }
    
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, requesterId: user.id })
    });
    if (res.ok) {
      setNewUser({ username: '', password: '', role: 'driver', pin: '' });
      setShowAddUserModal(false);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add user.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!confirm(`Are you sure you want to update the role/status for ${editingUser.username}?`)) {
      return;
    }

    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        role: editingUser.role, 
        status: editingUser.status, 
        password: editingUser.password,
        pin: editingUser.pin,
        requesterId: user.id 
      })
    });

    if (res.ok) {
      setEditingUser(null);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update user.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!hasPermission(user, 'manage_all_users') && !hasPermission(user, 'manage_drivers')) {
      alert('You do not have permission to delete users.');
      return;
    }
    if (id === user.id) {
      alert('You cannot delete yourself.');
      return;
    }
    const userToDelete = allUsers.find(u => u.id === id);
    if (userToDelete?.username === 'admin') {
      alert('The primary admin account cannot be deleted.');
      return;
    }
    if (!hasPermission(user, 'manage_all_users') && userToDelete?.role !== 'driver') {
      alert('You only have permission to delete driver accounts.');
      return;
    }
    if (user.role === 'supervisor' && userToDelete?.role === 'admin') {
      alert('Supervisors cannot delete admin accounts.');
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/users/${id}?requesterId=${user.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete user.');
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient),
    });
    if (res.ok) {
      setIsClientModalOpen(false);
      setNewClient({ name: '', address: '', phone: '', lat: undefined, lng: undefined });
      fetchData();
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    const res = await fetch(`/api/clients/${editingClient.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingClient),
    });
    if (res.ok) {
      setEditingClient(null);
      fetchData();
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleDispatchAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarm.client_name || !newAlarm.address) return;
    
    const res = await fetch('/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAlarm, dispatcher_id: user.id })
    });
    if (res.ok) {
      setNewAlarm({ client_name: '', address: '', assigned_driver_id: '', vehicle_id: '', alarm_type: 'Alarm', incident_details: '', priority: 'medium', lat: undefined, lng: undefined });
      setShowClientSuggestions(false);
      fetchData();
    }
  };

  const handleAssignDriver = async (alarmId: number, driverId: string, vehicleId?: string) => {
    // If no vehicleId provided, we'll try to find it from driverLocations
    let vId = vehicleId;
    if (!vId) {
      const driverLoc = driverLocations[parseInt(driverId)];
      if (driverLoc && driverLoc.vehicleId) {
        vId = driverLoc.vehicleId;
      }
    }

    const res = await fetch(`/api/alarms/${alarmId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId, vehicle_id: vId, requesterId: user.id })
    });
    if (res.ok) {
      setAssigningAlarm(null);
      setAssignmentData({ driverId: '', vehicleId: '' });
      fetchData();
    }
  };

  const handleUpdateDriverStatus = async (driverId: number, status: 'available' | 'busy') => {
    const res = await fetch(`/api/drivers/${driverId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleCancelAlarm = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this alarm?')) return;
    const res = await fetch(`/api/alarms/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId: user.id })
    });
    if (res.ok) {
      fetchData();
    }
  };

  return (
    <div className="space-y-6 relative">
      <header className={`bg-white text-slate-900 p-4 shadow-sm border-b border-slate-200 flex justify-between items-center mb-8 sticky top-0 z-40 ${
        viewMode === 'phone' 
          ? '-mx-4 -mt-4' 
          : '-mx-4 md:-mx-8 -mt-4 md:-mt-8'
      }`}>
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-bold tracking-tight text-rq-gold hidden sm:inline px-2 py-0.5 bg-rq-gold/10 rounded border border-rq-gold/20 uppercase text-[10px]">Dispatch</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-sm text-slate-600 hidden md:inline">
            <strong className="text-slate-900">{user.username}</strong> ({user.role})
          </span>
          <button
            id="btn-toggle-viewmode"
            onClick={() => setViewMode(viewMode === 'computer' ? 'phone' : 'computer')}
            className="text-xs bg-slate-100 hover:bg-slate-200 px-2 sm:px-3 py-1.5 rounded-xl transition-all text-slate-700 flex items-center gap-1.5 font-bold border border-slate-200 shadow-sm"
            title={viewMode === 'computer' ? "Simulate on Mobile" : "Switch to Computer View"}
          >
            {viewMode === 'computer' ? (
              <>
                <Smartphone size={14} className="text-slate-600" />
                <span className="hidden sm:inline">Mobile Screen</span>
              </>
            ) : (
              <>
                <Monitor size={14} className="text-slate-600" />
                <span className="hidden sm:inline">Computer Screen</span>
              </>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className="text-sm bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg transition-colors text-slate-700 border border-slate-200"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
          <button
            onClick={onLogout}
            className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors text-slate-700 flex items-center gap-2 border border-slate-200"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Notifications Container */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-80">
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            className={`${notif.type === 'sos' ? 'bg-red-700 border-red-600 ring-4 ring-red-400 animate-pulse' : notif.type === 'critical' ? 'bg-red-600 border-red-500' : 'bg-slate-900 border-slate-800'} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideIn border`}
          >
            {notif.type === 'sos' || notif.type === 'critical' ? <AlertTriangle size={18} className="text-white font-bold" /> : <Bell size={18} className="text-emerald-400" />}
            <span className="text-sm font-bold flex-1">{notif.message}</span>
            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {(() => {
        const sosDrivers = Object.values(driverLocations).filter((loc: any) => loc.isSOS);
        if (sosDrivers.length === 0) return null;
        return (
          <div className="bg-red-600 border-2 border-red-500 text-white p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-pulse mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white text-red-600 rounded-full animate-bounce">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-lg uppercase tracking-wider">🚨 HIGH-PRIORITY EMERGENCY SOS ACTIVE</h3>
                <p className="text-sm font-bold text-red-100 mt-0.5">
                  The following active responder(s) requested emergency assistance:{" "}
                  <span className="underline font-black">{sosDrivers.map((d: any) => d.driverName).join(", ")}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setActiveTab('map');
                  playNotificationSound();
                }}
                className="bg-white text-red-600 font-bold px-4 py-2 rounded-xl text-sm transition-colors hover:bg-slate-100 shadow cursor-pointer"
              >
                Focus Map
              </button>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Control Room</h2>
          <p className="text-slate-500 mt-1">Manage dispatch, vehicles, and view reports.</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          {hasPermission(user, 'dispatch_alarms') && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dispatch' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Dispatch
            </button>
          )}
          {hasPermission(user, 'view_map') && (
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'map' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MapIcon size={16} /> Map
            </button>
          )}
          {(hasPermission(user, 'view_all_reports') || hasPermission(user, 'view_assigned_reports')) && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Reports
            </button>
          )}
          {hasPermission(user, 'manage_vehicles') && (
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'vehicles' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Vehicles
            </button>
          )}
          {(hasPermission(user, 'manage_all_users') || hasPermission(user, 'manage_drivers')) && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Users
            </button>
          )}
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'clients' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Clients
          </button>
          <button
            id="tab-audit-logs"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Database size={16} /> Audit Logs
          </button>
        </div>
      </div>

      {activeTab === 'map' && (
        <DriverMap 
          locations={driverLocations} 
          alarms={alarms} 
          drivers={drivers} 
          vehicles={vehicles} 
          onAssignDriver={handleAssignDriver}
          selectedAlarmId={selectedAlarmId}
        />
      )}

      {activeTab === 'dispatch' && hasPermission(user, 'dispatch_alarms') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">New Dispatch</h3>
                  <p className="text-sm text-slate-500">Create and assign a new alarm</p>
                </div>
              </div>
              <form onSubmit={handleDispatchAlarm} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between items-center">
                  <span>Client Name</span>
                  <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">Database Search</span>
                </label>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={newAlarm.client_name}
                    onChange={(e) => {
                      setNewAlarm({ ...newAlarm, client_name: e.target.value });
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => setShowClientSuggestions(true)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none bg-slate-50"
                    placeholder="Search or enter client name"
                    required
                  />
                  
                  {showClientSuggestions && newAlarm.client_name && (
                    <div 
                      className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {clients
                        .filter(c => c.name.toLowerCase().includes(newAlarm.client_name.toLowerCase()))
                        .map(client => (
                          <button
                            key={client.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                            onClick={() => {
                              setNewAlarm({ 
                                ...newAlarm, 
                                client_name: client.name, 
                                address: client.address,
                                lat: client.lat,
                                lng: client.lng
                              });
                              setShowClientSuggestions(false);
                            }}
                          >
                            <div className="font-bold text-sm text-slate-900">{client.name}</div>
                            <div className="text-xs text-slate-500 truncate">{client.address}</div>
                          </button>
                        ))
                      }
                      {clients.filter(c => c.name.toLowerCase().includes(newAlarm.client_name.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-400 italic">
                          No existing client found. Will be added as a new entry.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Address</span>
                  <span className="text-xs text-rq-gold flex items-center gap-1"><MapPin size={12}/> AI Search</span>
                </label>
                <AddressAutocomplete 
                  value={newAlarm.address}
                  onChange={(val, lat, lng) => setNewAlarm({ ...newAlarm, address: val, lat, lng })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Alarm Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Alarm', 'Panic', 'Drive By'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewAlarm({ ...newAlarm, alarm_type: type })}
                      className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                        newAlarm.alarm_type === type 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Incident Details (Optional)</label>
                <textarea
                  value={newAlarm.incident_details}
                  onChange={(e) => setNewAlarm({ ...newAlarm, incident_details: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none bg-slate-50 resize-none h-24"
                  placeholder="e.g. Suspect seen near back entrance..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign Driver (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users size={18} className="text-slate-400" />
                  </div>
                  <select
                    value={newAlarm.assigned_driver_id}
                    onChange={(e) => setNewAlarm({ ...newAlarm, assigned_driver_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50 appearance-none"
                  >
                    <option value="">None (Pending)</option>
                    {drivers.filter(d => {
                      const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === d.id && ['dispatched', 'en_route', 'arrived'].includes(a.status));
                      return d.status !== 'busy' && !hasActiveAlarm;
                    }).map(d => (
                      <option key={d.id} value={d.id}>{d.username}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShieldCheck size={18} />
                  Dispatch Alarm Now
                </button>
              </div>
            </form>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Driver Status</h3>
                  <p className="text-sm text-slate-500">Manage driver availability</p>
                </div>
              </div>
              <div className="space-y-3">
                {drivers.map(driver => {
                  const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === driver.id && ['dispatched', 'en_route', 'arrived'].includes(a.status));
                  const isBusy = driver.status === 'busy' || hasActiveAlarm;
                  
                  return (
                    <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{driver.username}</span>
                        {driverLocations[driver.id]?.isOffline ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-red-600 font-black flex items-center gap-1 animate-pulse">
                              <AlertTriangle size={10} /> SIGNAL LOST
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium italic">
                              Last seen: {new Date(driverLocations[driver.id].lastUpdated).toLocaleTimeString()}
                            </span>
                          </div>
                        ) : driverLocations[driver.id] ? (
                          <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 size={10} /> LIVE TRACKING
                          </span>
                        ) : null}
                      </div>
                      {driver.is_on_shift ? (
                        <select
                          value={isBusy ? 'busy' : 'available'}
                          onChange={(e) => handleUpdateDriverStatus(driver.id, e.target.value as 'available' | 'busy')}
                          disabled={hasActiveAlarm}
                          className={`text-xs font-bold uppercase tracking-wider rounded-lg px-2 py-1.5 outline-none border ${
                            isBusy 
                              ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500' 
                              : 'bg-rq-gold/10 text-rq-gold border-rq-gold/20 focus:ring-rq-gold'
                          } ${hasActiveAlarm ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <option value="available">Available</option>
                          <option value="busy">{hasActiveAlarm ? 'Dispatched' : 'Busy'}</option>
                        </select>
                      ) : (
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
                          Off Duty
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-900">Dispatch Queue</h3>
                <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {alarms.length} Total
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {['all', 'pending', 'dispatched', 'completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      statusFilter === status 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 pb-2 font-semibold">Priority</th>
                    <th className="px-4 pb-2 font-semibold">Client & Address</th>
                    <th className="px-4 pb-2 font-semibold">Type & Driver</th>
                    <th className="px-4 pb-2 font-semibold">Status</th>
                    <th className="px-4 pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {alarms
                    .filter(a => statusFilter === 'all' || a.status === statusFilter)
                    .map(alarm => (
                    <tr key={alarm.id} className="group bg-white hover:bg-slate-50 transition-colors border border-slate-100 shadow-sm rounded-xl">
                      <td className="px-4 py-4 first:rounded-l-xl">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          alarm.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                          alarm.priority === 'high' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          alarm.priority === 'medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {alarm.priority || 'medium'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900">{alarm.client_name}</div>
                        <div className="text-slate-500 text-xs mt-0.5 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate max-w-[180px]">{alarm.address}</span>
                          </div>
                          {alarm.client_phone && (
                            <div className="flex items-center gap-1 text-rq-gold font-medium">
                              <Phone size={10} className="shrink-0" />
                              <span>{alarm.client_phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {alarm.alarm_type || 'Alarm'}
                          </span>
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                              <Users size={10} className="text-slate-500" />
                              {alarm.driver_name || 'Unassigned'}
                            </span>
                            {alarm.vehicle_registration && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-100">
                                <Car size={10} className="text-blue-500" />
                                {alarm.vehicle_registration}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight ${
                          alarm.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                          alarm.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                          alarm.status === 'pending' ? 'bg-red-100 text-red-700 animate-pulse' :
                          alarm.status === 'en_route' ? 'bg-blue-100 text-blue-700' :
                          alarm.status === 'arrived' ? 'bg-amber-100 text-amber-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {alarm.status === 'dispatched' ? 'Active' : 
                           alarm.status === 'completed' ? 'Resolved' : 
                           alarm.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right last:rounded-r-xl">
                        <div className="flex items-center justify-end gap-2">
                          {alarm.lat && alarm.lng && (
                            <button
                              onClick={() => {
                                setSelectedAlarmId(alarm.id);
                                setActiveTab('map');
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Go to Alarm on Map"
                            >
                              <MapIcon size={16} />
                            </button>
                          )}
                          {alarm.status === 'pending' && (
                            <button
                              onClick={() => {
                                setAssigningAlarm(alarm);
                                setAssignmentData({ driverId: '', vehicleId: '' });
                              }}
                              className="text-xs bg-emerald-500 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-emerald-600 transition-colors"
                            >
                              Assign
                            </button>
                          )}
                          {(alarm.status === 'pending' || alarm.status === 'dispatched' || alarm.status === 'en_route' || alarm.status === 'arrived') && (
                            <button
                              onClick={() => handleCancelAlarm(alarm.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Cancel Alarm"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {alarms.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <ShieldCheck size={32} className="text-slate-300 mb-3" />
                          <p>No alarms currently in the system</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (hasPermission(user, 'view_all_reports') || hasPermission(user, 'view_assigned_reports')) && (
        <div className="space-y-6">
          {/* Shift Summary Generator Bento Section */}
          <div className="bg-slate-950 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <FileText size={240} className="text-white" />
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                  <Sparkles size={12} /> AI-Powered Analytics
                </span>
                <h3 className="text-2xl font-black tracking-tight text-white">Daily Shift Operations & Telemetry Report</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Compile live incident logs, active driver duty shifts, and fleet GPS telemetry into a comprehensive, downloadable executive intelligence report.
                </p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Select Reporting Date</label>
                  <input
                    type="date"
                    value={selectedReportDate}
                    onChange={(e) => setSelectedReportDate(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
                <button
                  onClick={handleGenerateShiftSummary}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles size={16} /> Generate Shift Summary
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Call Out Reports</h3>
          <div className="space-y-6">
            {reports.map(report => (
              <div key={report.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{report.client_name}</h4>
                    <p className="text-slate-600 text-sm mt-1">{report.address}</p>
                  </div>
                  <div className="flex flex-col items-end text-sm text-slate-500">
                    <span>{new Date(report.created_at).toLocaleString()}</span>
                    <div className="flex gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700">
                        <Users size={12} /> {report.driver_name}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-700">
                        <Car size={12} /> {report.vehicle_registration}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Officer Feedback</h5>
                  <p className="text-slate-800 whitespace-pre-wrap text-sm">{report.feedback_text}</p>
                </div>

                {report.image_analysis && (
                  <div className="mt-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <h5 className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <ShieldCheck size={14} /> AI Image Analysis
                    </h5>
                    <p className="text-indigo-900 whitespace-pre-wrap text-sm">{report.image_analysis}</p>
                  </div>
                )}
              </div>
            ))}
            {reports.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No reports available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {activeTab === 'vehicles' && hasPermission(user, 'manage_vehicles') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Car className="text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-800">
                {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h3>
            </div>
            {editingVehicle ? (
              <form onSubmit={handleEditVehicle} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={editingVehicle.registration}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, registration: e.target.value })}
                    placeholder="Registration (e.g. RQ-003)"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <input
                    type="color"
                    value={editingVehicle.color || '#64748b'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                    className="w-12 h-10 p-1 border border-slate-300 rounded-lg cursor-pointer"
                    title="Vehicle Color"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVehicle(null)}
                    className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddVehicle} className="flex gap-3">
                <input
                  type="text"
                  value={newVehicle}
                  onChange={(e) => setNewVehicle(e.target.value)}
                  placeholder="Registration (e.g. RQ-003)"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
                <input
                  type="color"
                  value={newVehicleColor}
                  onChange={(e) => setNewVehicleColor(e.target.value)}
                  className="w-12 h-10 p-1 border border-slate-300 rounded-lg cursor-pointer"
                  title="Vehicle Color"
                />
                <button
                  type="submit"
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} /> Add
                </button>
              </form>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Fleet List</h3>
            <ul className="space-y-3">
              {vehicles.map(v => (
                <li key={v.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: v.color || '#64748b' }}>
                      <Car size={16} />
                    </div>
                    <span className="font-medium text-slate-800">{v.registration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingVehicle(v)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit Vehicle"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(v.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Vehicle"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {vehicles.length === 0 && (
                <li className="text-center py-4 text-slate-500">No vehicles found.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'users' && (hasPermission(user, 'manage_all_users') || hasPermission(user, 'manage_drivers')) && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900">User Management</h3>
              <p className="text-sm text-slate-500 mt-1">Manage system access and roles</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none text-sm transition-all"
                />
              </div>
              <div className="relative w-full sm:w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none text-sm appearance-none transition-all"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="control">Control Room</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="technician">Technician</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="w-full sm:w-auto bg-slate-900 text-white px-5 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Plus size={16} /> Add User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {allUsers
                  .filter(u => {
                    const matchesSearch = u.username.toLowerCase().includes(userSearch.toLowerCase());
                    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                    return matchesSearch && matchesRole;
                  })
                  .map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                          u.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' :
                          u.role === 'technician' ? 'bg-orange-100 text-orange-700' :
                          u.role === 'control' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                        u.role === 'supervisor' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        u.role === 'technician' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        u.role === 'control' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === 'driver' ? (
                        u.is_on_shift ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.status === 'busy' ? 'text-red-600' : 'text-emerald-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'busy' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                            {u.status === 'busy' ? 'Busy' : 'Available'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            Off Duty
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {(u.id === user.id || (hasPermission(user, 'manage_all_users') || (hasPermission(user, 'manage_drivers') && u.role === 'driver'))) && (
                          <button
                            onClick={() => setEditingUser(u)}
                            className="text-slate-400 hover:text-rq-gold p-2 rounded-lg hover:bg-rq-gold/10 transition-colors inline-flex items-center justify-center"
                            title="Edit user"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {u.id !== user.id && u.username !== 'admin' && (hasPermission(user, 'manage_all_users') || (hasPermission(user, 'manage_drivers') && u.role === 'driver')) && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                            title="Delete user"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {allUsers.filter(u => {
                    const matchesSearch = u.username.toLowerCase().includes(userSearch.toLowerCase());
                    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                    return matchesSearch && matchesRole;
                  }).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={32} className="text-slate-300" />
                        <p>No users found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative flex-1 w-full max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients by name, address or phone..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setIsClientModalOpen(true)}
              className="px-6 py-2.5 bg-rq-dark text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95"
            >
              <Plus size={20} /> Add Client
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.filter(c => 
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.address.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.phone?.toLowerCase().includes(clientSearch.toLowerCase())
                ).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        {c.phone || <span className="text-slate-300 italic">No phone</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {c.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingClient(c)}
                          className="text-slate-400 hover:text-rq-gold p-2 rounded-lg hover:bg-rq-gold/10 transition-colors"
                          title="Edit client"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(c.id)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete client"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.filter(c => 
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.address.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.phone?.toLowerCase().includes(clientSearch.toLowerCase())
                ).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Building2 size={32} className="text-slate-300" />
                        <p>No clients found matching your search.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Database className="text-slate-700" size={22} />
                System Activity & Audit Logs
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                A historical trace of security log events, dispatch actions, driver updates, and system activity.
              </p>
            </div>
            {user.role === 'admin' && (
              <button
                id="btn-clear-logs"
                onClick={async () => {
                  if (!confirm("Are you sure you want to permanently delete all historical activity and audit logs? This action is irreversible.")) return;
                  try {
                    const res = await fetch('/api/activity-logs/clear', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ requesterId: user.id })
                    });
                    if (res.ok) {
                      setActivityLogs([]);
                      alert("Logs cleared successfully.");
                    } else {
                      const data = await res.json();
                      alert(data.error || "Failed to clear logs.");
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-semibold transition-all border border-red-100 flex items-center gap-1.5"
              >
                <Trash2 size={16} />
                Clear Audit History
              </button>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                <Filter size={16} className="text-slate-400" />
                <span>Filter Logs</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search size={16} className="text-slate-400" />
                  </span>
                  <input
                    id="input-search-logs"
                    type="text"
                    placeholder="Search logs by operator or details..."
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  />
                  {logsSearch && (
                    <button 
                      onClick={() => setLogsSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      <X size={14} className="text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
                
                <select
                  id="select-filter-action"
                  value={logsFilterAction}
                  onChange={(e) => setLogsFilterAction(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">All Event Types</option>
                  <option value="login">Logins & PIN Access</option>
                  <option value="dispatch">Dispatches & Assignments</option>
                  <option value="status">Status Updates</option>
                  <option value="cancel">Cancellations</option>
                  <option value="shiftevents">Shift Start/End</option>
                  <option value="feedback">Incident & Feedback Reports</option>
                  <option value="clear_logs">Admin Auditing</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Event</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-44">Operator</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityLogs
                    .filter(log => {
                      // Action Type filtering logic
                      if (logsFilterAction === 'login') {
                        return ['login', 'login_pin', 'login_failed', 'login_pin_failed'].includes(log.action);
                      }
                      if (logsFilterAction === 'dispatch') {
                        return ['create_alarm', 'assign_alarm'].includes(log.action);
                      }
                      if (logsFilterAction === 'status') {
                        return log.action === 'update_status';
                      }
                      if (logsFilterAction === 'cancel') {
                        return log.action === 'cancel_alarm';
                      }
                      if (logsFilterAction === 'shiftevents') {
                        return ['shift_start', 'shift_end'].includes(log.action);
                      }
                      if (logsFilterAction === 'feedback') {
                        return log.action === 'submit_incident_report';
                      }
                      if (logsFilterAction === 'clear_logs') {
                        return log.action === 'clear_logs';
                      }
                      return true;
                    })
                    .filter(log => {
                      // Text search filtering logic
                      const searchLower = logsSearch.toLowerCase();
                      const usernameMatch = log.username ? log.username.toLowerCase().includes(searchLower) : false;
                      const roleMatch = log.role ? log.role.toLowerCase().includes(searchLower) : false;
                      const detailsMatch = log.details ? log.details.toLowerCase().includes(searchLower) : false;
                      const actionMatch = log.action.toLowerCase().includes(searchLower);
                      return !logsSearch || usernameMatch || roleMatch || detailsMatch || actionMatch;
                    })
                    .map((log) => {
                      // Badge color mapping
                      let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                      let actionDisplay = log.action.replace('_', ' ');
                      
                      if (log.action.includes('failed')) {
                        badgeBg = 'bg-red-50 text-red-600 border-red-100';
                      } else if (log.action === 'login' || log.action === 'login_pin') {
                        badgeBg = 'bg-blue-50 text-blue-700 border-blue-100';
                      } else if (log.action === 'create_alarm' || log.action === 'assign_alarm') {
                        badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      } else if (log.action === 'update_status') {
                        badgeBg = 'bg-amber-50 text-amber-700 border-amber-100';
                      } else if (log.action === 'cancel_alarm') {
                        badgeBg = 'bg-rose-50 text-rose-700 border-rose-100';
                      } else if (log.action === 'shift_start' || log.action === 'shift_end') {
                        badgeBg = 'bg-purple-50 text-purple-700 border-purple-100';
                      } else if (log.action === 'submit_incident_report') {
                        badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                      } else if (log.action === 'clear_logs') {
                        badgeBg = 'bg-sky-50 text-sky-700 border-sky-100';
                      }

                      // Convert database timestamp to comfortable local display
                      let dateStr = log.created_at;
                      try {
                        const parsedDate = new Date(log.created_at.replace(' ', 'T') + 'Z');
                        if (!isNaN(parsedDate.getTime())) {
                          dateStr = parsedDate.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          });
                        }
                      } catch (e) {}

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-slate-400" />
                              {dateStr}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border uppercase tracking-wider ${badgeBg}`}>
                              {actionDisplay}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.username ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                  <UserIcon size={12} className="text-slate-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">{log.username}</div>
                                  <div className="text-xs text-slate-400 capitalize">{log.role || 'Operator'}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-sm">Anonymous</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })}

                  {activityLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                          {logsLoading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-950 font-sans">Loading...</div>
                          ) : (
                            <>
                              <Database size={36} className="text-slate-300" />
                              <p className="font-semibold text-slate-600">No activity logs recorded yet.</p>
                              <p className="text-xs text-slate-400">Security audits will show up once system actions are triggered.</p>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="p-2 bg-rq-gold/10 text-rq-gold rounded-xl">
                <Bell size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Notification Preferences</h2>
                <p className="text-sm text-slate-500">Configure how and when you receive system alerts</p>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <SettingsIcon size={14} />
                  General Controls
                </h3>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-rq-gold/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                      <Bell size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Audio Feedback</div>
                      <p className="text-xs text-slate-500">Play a chime when new notifications arrive</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setNotifSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                    className={`w-14 h-8 rounded-full transition-all relative ${notifSettings.soundEnabled ? 'bg-rq-gold' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${notifSettings.soundEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Filter size={14} />
                  Alert Categories
                </h3>
                
                <div className="grid gap-3">
                  {[
                    { key: 'newDispatches' as const, label: 'New Dispatches', sub: 'Alert when driver assignments are made', icon: <Plus size={18} /> },
                    { key: 'statusUpdates' as const, label: 'Status Updates', sub: 'Alert when incident status changes', icon: <Clock size={18} /> },
                    { key: 'feedbacks' as const, label: 'Driver Feedback', sub: 'Alert when a driver submits a local report', icon: <ShieldCheck size={18} /> }
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          {item.icon}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">{item.label}</div>
                          <p className="text-[10px] text-slate-500">{item.sub}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setNotifSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        className={`w-12 h-7 rounded-full transition-all relative ${notifSettings[item.key] ? 'bg-slate-900 text-white' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${notifSettings[item.key] ? 'left-5.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 italic text-[10px] text-slate-400">
              Settings are saved automatically to your browser's local storage.
            </div>
          </div>

          {/* Telegram Bot Integration Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl animate-pulse">
                <MessageSquare size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">Telegram Bot Integration</h2>
                <p className="text-sm text-slate-500">Monitor dispatches, stream SOS alerts and execute commands directly from Telegram</p>
              </div>
              <div className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 ${
                telegramEnabled 
                  ? telegramStatus.includes('Active') 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  telegramEnabled 
                    ? telegramStatus.includes('Active') 
                      ? 'bg-emerald-500 animate-pulse' 
                      : 'bg-amber-500' 
                    : 'bg-slate-400'
                }`} />
                {telegramEnabled ? telegramStatus : 'Disabled'}
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Alert status or instructions info block */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <SettingsIcon size={14} className="text-slate-400" />
                  Integration Setup Guide
                </h4>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                  <li>Search for <span className="font-semibold text-slate-800">@BotFather</span> inside Telegram and send <code className="bg-slate-200 px-1 py-0.5 rounded text-rose-600">/newbot</code>.</li>
                  <li>Copy the generated <span className="font-semibold text-emerald-600">API Access Token</span>.</li>
                  <li>Message your bot directly (<code className="bg-slate-200 px-1 py-0.5 rounded">/start</code>) or add it to your channel.</li>
                  <li>Retrieve your group or personal Chat ID (e.g., forward a message to <span className="font-semibold text-slate-800">@userinfobot</span>).</li>
                  <li>Enable the bot toggle below and click <span className="font-semibold">Save Configuration</span>!</li>
                </ol>
              </div>

              {/* Token and Chat ID Input */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <Key size={12} className="text-slate-400" />
                    Bot Token / Key
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 123456789:ABCdefGhI..."
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50/50"
                  />
                  <p className="text-[10px] text-slate-400">Tokens are securely stored in the database.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <MessageSquare size={12} className="text-slate-400" />
                    Target Chat ID / Channel ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. -100123456789 or 987654321"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50/50"
                  />
                  <p className="text-[10px] text-slate-400">Can be a private group or single user ID.</p>
                </div>
              </div>

              {/* Bot Enabled and Toggles */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-sky-500 shadow-sm border border-slate-100">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">Enable Bot Polling & Notifications</div>
                      <p className="text-xs text-slate-400">Starts the bidirectional polling loop on your server</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setTelegramEnabled(!telegramEnabled)}
                    className={`w-12 h-7 rounded-full transition-all relative ${telegramEnabled ? 'bg-sky-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${telegramEnabled ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Sub features if enabled */}
                {telegramEnabled && (
                  <div className="grid gap-3 pl-2 border-l-2 border-slate-200 animate-slideDown">
                    <div className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all">
                      <div>
                        <div className="font-bold text-xs text-slate-900">🚨 Stream Active SOS Alerts</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Push critical SOS signals with live tracking data directly to chat</p>
                      </div>
                      <button 
                        onClick={() => setTelegramNotifySOS(!telegramNotifySOS)}
                        className={`w-10 h-6 rounded-full transition-all relative ${telegramNotifySOS ? 'bg-slate-800' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${telegramNotifySOS ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all">
                      <div>
                        <div className="font-bold text-xs text-slate-900">📋 Dispatch Incident Forwarder</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Relay newly generated alarm events & driver assignments instantly</p>
                      </div>
                      <button 
                        onClick={() => setTelegramNotifyAlarms(!telegramNotifyAlarms)}
                        className={`w-10 h-6 rounded-full transition-all relative ${telegramNotifyAlarms ? 'bg-slate-800' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${telegramNotifyAlarms ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {/* Interactive Telemetry Help block */}
                    <div className="p-3 bg-indigo-50/55 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 leading-relaxed">
                      💡 <b>Two-Way Commands Enabled:</b> When the bot polling is active, operators can query the control room directly inside Telegram group! Try typing <code>/status</code>, <code>/alarms</code>, <code>/drivers</code>, or try triggering an SOS trigger via <code>/sos [incident report]</code>.
                    </div>
                  </div>
                )}
              </div>

              {/* Save & Test Actions buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-4">
                <button
                  type="button"
                  onClick={testTelegramIntegration}
                  disabled={testingTelegram || !telegramToken || !telegramChatId}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 font-bold text-xs rounded-xl flex items-center gap-2 transition-all"
                >
                  {testingTelegram ? (
                    'Sending Test...'
                  ) : (
                    <>
                      <Send size={14} />
                      Test Telegram Connection
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={saveTelegramConfig}
                  disabled={isSavingTelegram}
                  className="px-6 py-2.5 bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-sky-500/10"
                >
                  {isSavingTelegram ? 'Saving Settings...' : 'Save Configuration'}
                </button>
              </div>

              {/* Connect test results feedback panel */}
              {telegramTestResult && (
                <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border animate-fadeIn ${
                  telegramTestResult.success 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                    : 'bg-rose-50 text-rose-800 border-rose-100'
                }`}>
                  <div className="mt-0.5">
                    {telegramTestResult.success ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
                  </div>
                  <div className="flex-1">
                    {telegramTestResult.success ? (
                      <>
                        <p className="font-bold">Test Message Dispatched Successfully!</p>
                        <p className="mt-0.5 text-[11px] opacity-90">Please check your Telegram chat or channel for the test verification text.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold">Verification Test Failed</p>
                        <p className="mt-0.5 text-[11px] opacity-90">{telegramTestResult.error || 'Server rejected request. Please check Bot token and Chat ID.'}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="italic text-[10px] text-slate-400">Settings are persisted to the main database and initialized instantly.</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">v1.2 // Telegram Connector API</span>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assigningAlarm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Alarm</h3>
                <p className="text-xs text-slate-500 mt-0.5">{assigningAlarm.client_name} • {assigningAlarm.address}</p>
              </div>
              <button 
                onClick={() => setAssigningAlarm(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Driver</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users size={18} className="text-slate-400" />
                  </div>
                  <select
                    value={assignmentData.driverId}
                    onChange={(e) => setAssignmentData({ ...assignmentData, driverId: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none bg-slate-50 appearance-none"
                  >
                    <option value="">Select a driver...</option>
                    {drivers.filter(d => {
                      const hasActiveAlarm = alarms.some(a => a.assigned_driver_id === d.id && ['dispatched', 'en_route', 'arrived'].includes(a.status));
                      return d.status !== 'busy' && !hasActiveAlarm;
                    }).map(d => (
                      <option key={d.id} value={d.id}>{d.username}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setAssigningAlarm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignDriver(assigningAlarm.id, assignmentData.driverId)}
                disabled={!assignmentData.driverId}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <UserPlus className="text-rq-gold" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Add New User</h3>
              </div>
              <button 
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                  placeholder="Enter password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all appearance-none"
                  required
                >
                  <option value="driver">Driver</option>
                  {hasPermission(user, 'manage_all_users') && <option value="control">Control Room</option>}
                  {hasPermission(user, 'manage_all_users') && <option value="technician">Technician</option>}
                  {hasPermission(user, 'manage_all_users') && <option value="supervisor">Supervisor</option>}
                  {hasPermission(user, 'manage_all_users') && <option value="admin">Admin</option>}
                </select>
              </div>
              {newUser.role === 'driver' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">4-Digit PIN (For Driver Login)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all tracking-widest"
                    placeholder="••••"
                    required
                  />
                </div>
              )}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-rq-dark text-white px-4 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Edit2 className="text-rq-gold" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Edit User: {editingUser.username}</h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all appearance-none"
                  required
                  disabled={!hasPermission(user, 'manage_all_users') || editingUser.username === 'admin'}
                >
                  <option value="driver">Driver</option>
                  <option value="control">Control Room</option>
                  <option value="technician">Technician</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
                {(!hasPermission(user, 'manage_all_users') || editingUser.username === 'admin') && (
                  <p className="mt-1 text-xs text-slate-400">Role changes restricted or not allowed for this user.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                <select
                  value={editingUser.status || 'available'}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as 'available' | 'busy' })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all appearance-none"
                  required
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                </select>
              </div>

              {user.role === 'admin' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {editingUser.role === 'driver' ? 'Reset PIN (4-Digit)' : 'Reset Password'}
                    </label>
                    <input
                      type={editingUser.role === 'driver' ? 'password' : 'text'}
                      inputMode={editingUser.role === 'driver' ? 'numeric' : 'text'}
                      pattern={editingUser.role === 'driver' ? '[0-9]*' : undefined}
                      maxLength={editingUser.role === 'driver' ? 4 : undefined}
                      value={editingUser.role === 'driver' ? (editingUser.pin || '') : (editingUser.password || '')}
                      onChange={(e) => {
                        if (editingUser.role === 'driver') {
                          setEditingUser({ ...editingUser, pin: e.target.value });
                        } else {
                          setEditingUser({ ...editingUser, password: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                      placeholder={editingUser.role === 'driver' ? "Leave blank to keep current" : "Enter new password (optional)"}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">Only administrators can change credentials.</p>
                  </div>
                </>
              )}
              
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-rq-dark text-white px-4 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="text-rq-gold" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Add New Client</h3>
              </div>
              <button 
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Name</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                  placeholder="Enter client name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                  placeholder="e.g. +27 12 345 6789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Address</span>
                  <span className="text-[10px] text-slate-400 font-normal">Use Autocomplete</span>
                </label>
                <AddressAutocomplete
                  value={newClient.address}
                  onChange={(address, lat, lng) => setNewClient({ ...newClient, address, lat, lng })}
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-rq-dark text-white px-4 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Edit2 className="text-rq-gold" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Edit Client: {editingClient.name}</h3>
              </div>
              <button 
                onClick={() => setEditingClient(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateClient} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Name</label>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={editingClient.phone}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none transition-all"
                  placeholder="e.g. +27 12 345 6789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Address</span>
                  <span className="text-[10px] text-slate-400 font-normal">Use Autocomplete</span>
                </label>
                <AddressAutocomplete
                  value={editingClient.address || ''}
                  onChange={(address, lat, lng) => setEditingClient({ ...editingClient, address, lat, lng })}
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-rq-dark text-white px-4 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Summary Report Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Shift Operations Intelligence Report</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Date: {selectedReportDate} {summaryReport?.isFallback ? '(Simulation Fallback)' : ''}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Sub-Header (Actions) */}
            {summaryReport && (
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5 overflow-x-auto">
                  {(['summary', 'alarms', 'shifts', 'fleet'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveSummaryTab(tab)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
                        activeSummaryTab === tab 
                          ? 'bg-slate-900 text-white shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      {tab === 'summary' ? '✨ AI Summary' : tab === 'alarms' ? '🚨 Incidents' : tab === 'shifts' ? '👥 Duty Shifts' : '🚗 Fleet Telemetry'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadHTMLReport}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer"
                    title="Download styled print-ready HTML document"
                  >
                    <Download size={14} /> Download HTML
                  </button>
                  <button
                    onClick={handleDownloadMarkdownReport}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Download as standard Markdown text file"
                  >
                    <FileText size={14} /> Download MD
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body / Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
              {isGeneratingSummary ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <RefreshCw className="animate-spin text-amber-500" size={40} />
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-lg">Compiling Operational Records...</p>
                    <p className="text-xs text-slate-500 mt-1">Analyzing incident logs, GPS logs, and shift rosters with Gemini</p>
                  </div>
                </div>
              ) : summaryReport ? (
                <div className="space-y-6">
                  
                  {/* Tab Contents: AI Summary */}
                  {activeSummaryTab === 'summary' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-500 font-bold mb-4">
                        <Sparkles size={18} />
                        <span className="text-sm uppercase tracking-wider font-mono">Executive Operations Analysis</span>
                      </div>
                      <div className="prose max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                        {summaryReport.summary}
                      </div>
                    </div>
                  )}

                  {/* Tab Contents: Incidents */}
                  {activeSummaryTab === 'alarms' && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="font-bold text-slate-800 text-sm">Incident Dispatch Log</span>
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-bold">{summaryReport.alarms.length} Recorded</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
                              <th className="px-5 py-3">ID</th>
                              <th className="px-5 py-3">Client & Address</th>
                              <th className="px-5 py-3">Priority</th>
                              <th className="px-5 py-3">Type</th>
                              <th className="px-5 py-3">Assigned Driver</th>
                              <th className="px-5 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {summaryReport.alarms.map((a: any) => (
                              <tr key={a.id} className="hover:bg-slate-50/40">
                                <td className="px-5 py-3.5 font-mono text-xs text-slate-400">#{a.id}</td>
                                <td className="px-5 py-3.5">
                                  <div className="font-bold text-slate-900">{a.client_name}</div>
                                  <div className="text-slate-500 text-xs mt-0.5">{a.address}</div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    a.priority === 'critical' ? 'bg-red-50 text-red-700 border border-red-100' :
                                    a.priority === 'high' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                    'bg-slate-50 text-slate-500'
                                  }`}>{a.priority || 'medium'}</span>
                                </td>
                                <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">{a.alarm_type || 'Alarm'}</td>
                                <td className="px-5 py-3.5 text-xs text-slate-600">{a.driver_name || 'Unassigned'}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    a.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                    a.status === 'pending' ? 'bg-red-50 text-red-700' :
                                    'bg-blue-50 text-blue-700'
                                  }`}>{a.status}</span>
                                </td>
                              </tr>
                            ))}
                            {summaryReport.alarms.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">No alarms recorded for this date</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab Contents: Duty Shifts */}
                  {activeSummaryTab === 'shifts' && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="font-bold text-slate-800 text-sm">Duty Shifts & Distance</span>
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-bold">{summaryReport.shifts.length} Shifts active</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
                              <th className="px-5 py-3">Driver Name</th>
                              <th className="px-5 py-3">Shift Start</th>
                              <th className="px-5 py-3">Shift End</th>
                              <th className="px-5 py-3">Distance Covered</th>
                              <th className="px-5 py-3">Alarms Resolved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {summaryReport.shifts.map((s: any) => (
                              <tr key={s.id} className="hover:bg-slate-50/40">
                                <td className="px-5 py-3.5 font-bold text-slate-900">{s.driver_name}</td>
                                <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{new Date(s.start_time).toLocaleString()}</td>
                                <td className="px-5 py-3.5 text-xs font-mono">
                                  {s.end_time ? new Date(s.end_time).toLocaleString() : <span className="text-emerald-600 font-bold">ACTIVE SHIFT</span>}
                                </td>
                                <td className="px-5 py-3.5 text-xs font-mono font-bold text-slate-800">{(s.distance_covered || 0).toFixed(1)} km</td>
                                <td className="px-5 py-3.5 font-semibold text-slate-700">{s.alarms_completed || 0}</td>
                              </tr>
                            ))}
                            {summaryReport.shifts.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">No shifts active on this date</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab Contents: Fleet Status */}
                  {activeSummaryTab === 'fleet' && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="font-bold text-slate-800 text-sm">Active Fleet Status & GPS Telemetry</span>
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-bold">{summaryReport.vehicles.length} Units Online</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
                              <th className="px-5 py-3">Vehicle</th>
                              <th className="px-5 py-3">Registration</th>
                              <th className="px-5 py-3">Last GPS Location</th>
                              <th className="px-5 py-3">Assigned Patrol Officer</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {summaryReport.vehicles.map((v: any) => (
                              <tr key={v.id} className="hover:bg-slate-50/40">
                                <td className="px-5 py-3.5 flex items-center gap-3">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color || '#64748b' }}></span>
                                  <span className="font-bold text-slate-800">RQ Response Unit</span>
                                </td>
                                <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-950">{v.registration}</td>
                                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                                  {v.lat ? `${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}` : 'No Active GPS Broadcast'}
                                </td>
                                <td className="px-5 py-3.5 text-xs">
                                  {v.active_driver ? (
                                    <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-semibold border border-blue-100">
                                      {v.active_driver}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Patrol Ready / Standby</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {summaryReport.vehicles.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-5 py-10 text-center text-slate-400">No fleet vehicles in database</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <p>Failed to generate shift summary report.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-mono">CONFIDENTIAL OPERATIONS RECORD</span>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
