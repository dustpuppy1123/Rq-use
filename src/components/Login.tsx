import React, { useState, useEffect } from 'react';
import { User } from '../types';
import Logo from './Logo';
import { Link } from 'react-router';
import { KeyRound, User as UserIcon, Home } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  forcedMode?: 'admin' | 'driver';
}

export default function Login({ onLogin, forcedMode }: LoginProps) {
  const [loginMode, setLoginMode] = useState<'admin' | 'driver'>(forcedMode || 'driver');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  useEffect(() => {
    if (forcedMode) {
      setLoginMode(forcedMode);
    }
  }, [forcedMode]);
  
  // Driver login state
  const [drivers, setDrivers] = useState<{id: number, username: string}[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [pin, setPin] = useState('');

  // Admin login state
  const [adminUsers, setAdminUsers] = useState<{id: number, username: string, role: string}[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          const staff = data.filter((u: any) => u.role !== 'driver');
          setAdminUsers(staff);
          if (staff.length > 0) setUsername(staff[0].username);
        }
      } catch (err) {
        console.warn('Initial users fetch failed, retrying in 2s...');
        setTimeout(fetchUsers, 2000);
      }
    };
    fetchUsers();
  }, []);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await fetch('/api/drivers');
        if (res.ok) {
          const data = await res.json();
          setDrivers(data);
          if (data.length > 0) setSelectedDriverId(String(data[0].id));
        } else {
          // If server returns error, might still be booting or initializing DB
          console.warn('Server returned error for drivers, retrying...');
          setTimeout(fetchDrivers, 2000);
        }
      } catch (err) {
        console.warn('Initial drivers fetch failed, retrying in 2s...');
        setTimeout(fetchDrivers, 2000);
      }
    };
    fetchDrivers();
  }, []);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriverId, pin }),
      });

      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid PIN');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-slate-100">
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" className="mb-4" />
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {!forcedMode && (
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onClick={() => { setLoginMode('driver'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${loginMode === 'driver' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <KeyRound size={16} /> Driver PIN
            </button>
            <button
              onClick={() => { setLoginMode('admin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${loginMode === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserIcon size={16} /> Admin / Staff
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
            {error}
          </div>
        )}

        {loginMode === 'driver' ? (
          <form onSubmit={handleDriverSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Driver</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rq-gold focus:border-rq-gold outline-none transition-all bg-white"
                required
              >
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">4-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rq-gold focus:border-rq-gold outline-none transition-all text-center text-2xl tracking-[0.5em]"
                placeholder="••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !selectedDriverId || pin.length < 4}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Username</label>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rq-gold focus:border-rq-gold outline-none transition-all bg-white"
                required
              >
                {adminUsers.map(u => (
                  <option key={u.id} value={u.username}>{u.username} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rq-gold focus:border-rq-gold outline-none transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-slate-400 hover:text-rq-gold text-sm font-medium transition-colors"
          >
            <Home size={16} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
