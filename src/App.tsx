/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useState, useEffect } from 'react';
import Portal from './components/Portal';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DriverDashboard from './components/DriverDashboard';
import PhoneContainer from './components/PhoneContainer';
import { User } from './types';
import { Monitor } from 'lucide-react';

export default function App() {
  const [dispatchUser, setDispatchUser] = useState<User | null>(null);
  const [driverUser, setDriverUser] = useState<User | null>(null);
  const [dispatchViewMode, setDispatchViewMode] = useState<'computer' | 'phone'>('computer');

  const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

  useEffect(() => {
    const checkAuth = () => {
      const storedDispatch = localStorage.getItem('rq_user_dispatch');
      const storedDriver = localStorage.getItem('rq_user_driver');

      if (storedDispatch) {
        const parsed = JSON.parse(storedDispatch);
        const lastActive = localStorage.getItem(`rq_dispatch_last_active_${parsed.id}`);
        if (lastActive && Date.now() - parseInt(lastActive) > TIMEOUT_MS) {
          localStorage.removeItem('rq_user_dispatch');
          setDispatchUser(null);
        } else {
          setDispatchUser(parsed);
        }
      } else {
        setDispatchUser(null);
      }

      if (storedDriver) {
        setDriverUser(JSON.parse(storedDriver));
      } else {
        setDriverUser(null);
      }
    };

    checkAuth();
    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDispatchLogin = (user: User) => {
    setDispatchUser(user);
    localStorage.setItem('rq_user_dispatch', JSON.stringify(user));
    localStorage.setItem(`rq_dispatch_last_active_${user.id}`, Date.now().toString());
  };

  const handleDriverLogin = (user: User) => {
    setDriverUser(user);
    localStorage.setItem('rq_user_driver', JSON.stringify(user));
  };

  const handleDispatchLogout = () => {
    if (dispatchUser) {
      localStorage.removeItem(`rq_dispatch_last_active_${dispatchUser.id}`);
    }
    localStorage.removeItem('rq_user_dispatch');
    setDispatchUser(null);
  };

  const handleDriverLogout = () => {
    localStorage.removeItem('rq_user_driver');
    if (driverUser) {
      localStorage.removeItem(`rq_vehicle_${driverUser.id}`);
    }
    setDriverUser(null);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Routes>
          <Route path="/" element={<Portal />} />
          
          {/* Dispatch System */}
          <Route
            path="/admin/*"
            element={
              !dispatchUser ? (
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                  <Login onLogin={handleDispatchLogin} forcedMode="admin" />
                </div>
              ) : dispatchViewMode === 'phone' ? (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center py-6 px-4">
                  {/* Floating Controller above physical frame */}
                  <div className="mb-4 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 text-white z-50">
                    <span className="text-xs font-semibold text-slate-400">Dispatch Preview Mode:</span>
                    <button
                      onClick={() => setDispatchViewMode('computer')}
                      className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 bg-gradient-to-r hover:from-slate-650 hover:to-slate-550 rounded-full font-bold transition-all text-white border border-slate-600"
                    >
                      <Monitor size={14} /> Back to Computer
                    </button>
                  </div>
                  <PhoneContainer isSimulatedOnly={true} className="p-0 bg-slate-50">
                    <AdminDashboard 
                      user={dispatchUser} 
                      onLogout={handleDispatchLogout} 
                      viewMode={dispatchViewMode}
                      onViewModeChange={setDispatchViewMode}
                    />
                  </PhoneContainer>
                </div>
              ) : (
                <div className="p-0">
                  <AdminDashboard 
                    user={dispatchUser} 
                    onLogout={handleDispatchLogout} 
                    viewMode={dispatchViewMode}
                    onViewModeChange={setDispatchViewMode}
                  />
                </div>
              )
            }
          />

          {/* Driver System */}
          <Route
            path="/driver/*"
            element={
              <PhoneContainer title="RQ Driver Terminal">
                {!driverUser ? (
                  <div className="p-4 bg-white h-full flex flex-col justify-center">
                    <Login onLogin={handleDriverLogin} forcedMode="driver" />
                  </div>
                ) : (
                  <div className="p-0 h-full flex flex-col">
                    <DriverDashboard user={driverUser} onLogout={handleDriverLogout} />
                  </div>
                )}
              </PhoneContainer>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

