import React, { useState, useEffect } from 'react';
import { X, Bell, Volume2, VolumeX, Save, Smartphone } from 'lucide-react';
import { showPushNotification } from '../utils/notifications';
import { User } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  pushEnabled: boolean;
  alertTypes: {
    newDispatch: boolean;
    statusUpdates: boolean;
    feedback: boolean;
  };
}

export const defaultPreferences: NotificationPreferences = {
  soundEnabled: true,
  pushEnabled: true,
  alertTypes: {
    newDispatch: true,
    statusUpdates: true,
    feedback: true,
  }
};

export const getPreferences = (userId?: number): NotificationPreferences => {
  if (!userId) return defaultPreferences;
  const stored = localStorage.getItem(`rq_notification_prefs_${userId}`);
  if (stored) {
    try {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    } catch (e) {
      return defaultPreferences;
    }
  }
  return defaultPreferences;
};

export default function ProfileSettings({ isOpen, onClose, user }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    if (isOpen) {
      setPrefs(getPreferences(user.id));
    }
  }, [isOpen, user.id]);

  const handleSave = () => {
    localStorage.setItem(`rq_notification_prefs_${user.id}`, JSON.stringify(prefs));
    onClose();
  };

  const handleTestNotification = () => {
    showPushNotification(user.id, 'Test Notification', 'This is a test to verify your dispatch alerts are working correctly.', 'statusUpdates');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Bell size={20} className="text-emerald-500" />
            Notification Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">General</h3>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${prefs.pushEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Bell size={18} />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Push Notifications</div>
                  <div className="text-xs text-slate-500">Show desktop alerts</div>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${prefs.pushEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={prefs.pushEnabled}
                  onChange={(e) => setPrefs({...prefs, pushEnabled: e.target.checked})}
                />
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${prefs.pushEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${prefs.soundEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                  {prefs.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </div>
                <div>
                  <div className="font-medium text-slate-900">Alert Sounds</div>
                  <div className="text-xs text-slate-500">Play sound on new alerts</div>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative ${prefs.soundEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={prefs.soundEnabled}
                  onChange={(e) => setPrefs({...prefs, soundEnabled: e.target.checked})}
                />
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${prefs.soundEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Alert Types</h3>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="font-medium text-slate-700">New Dispatches</div>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                checked={prefs.alertTypes.newDispatch}
                onChange={(e) => setPrefs({...prefs, alertTypes: {...prefs.alertTypes, newDispatch: e.target.checked}})}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div className="font-medium text-slate-700">Status Updates</div>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                checked={prefs.alertTypes.statusUpdates}
                onChange={(e) => setPrefs({...prefs, alertTypes: {...prefs.alertTypes, statusUpdates: e.target.checked}})}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div className="font-medium text-slate-700">Feedback & Reports</div>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                checked={prefs.alertTypes.feedback}
                onChange={(e) => setPrefs({...prefs, alertTypes: {...prefs.alertTypes, feedback: e.target.checked}})}
              />
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
          <button 
            onClick={handleTestNotification}
            className="px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <Smartphone size={16} /> Test Alerts
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
            >
              <Save size={16} /> Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
