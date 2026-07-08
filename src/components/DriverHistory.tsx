import { useState, useEffect } from 'react';
import { User, Alarm, Feedback } from '../types';
import { 
  CheckCircle2, 
  FileText, 
  Clock, 
  MapPin, 
  Car, 
  ShieldAlert, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info
} from 'lucide-react';

interface DriverHistoryProps {
  user: User;
}

export default function DriverHistory({ user }: DriverHistoryProps) {
  const [completedAlarms, setCompletedAlarms] = useState<Alarm[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'dispatches' | 'reports'>('dispatches');
  const [expandedAlarmId, setExpandedAlarmId] = useState<number | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/drivers/${user.id}/history`);
        if (!res.ok) {
          throw new Error('Failed to retrieve driver history log');
        }
        const json = await res.json();
        setCompletedAlarms(json.completedAlarms || []);
        setFeedbacks(json.feedbacks || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching driver history:', err);
        setError(err.message || 'Unable to load service history');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user.id]);

  const toggleAlarmExpand = (id: number) => {
    setExpandedAlarmId(prev => prev === id ? null : id);
  };

  const toggleReportExpand = (id: number) => {
    setExpandedReportId(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">Retrieving Service Logs...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching your past resolved dispatches and incident reports</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-100 text-center text-rose-600 flex flex-col items-center min-h-[300px] justify-center">
        <ShieldAlert size={48} className="text-rose-500 mb-3 animate-bounce" />
        <h3 className="font-bold text-lg text-slate-900">History Sync Interrupted</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all shadow-md cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* KPI Counters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 size={22} />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Completed</span>
            <span className="text-xl font-extrabold text-slate-900">{completedAlarms.length}</span>
            <span className="text-[10px] text-slate-400 block">dispatches resolved</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <FileText size={22} />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Incident Reports</span>
            <span className="text-xl font-extrabold text-slate-900">{feedbacks.length}</span>
            <span className="text-[10px] text-slate-400 block">submitted forms</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 max-w-xs mx-auto">
        <button
          onClick={() => setSubTab('dispatches')}
          className={`flex-1 py-2 rounded-lg text-center font-bold text-xs transition-all ${
            subTab === 'dispatches'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Dispatches ({completedAlarms.length})
        </button>
        <button
          onClick={() => setSubTab('reports')}
          className={`flex-1 py-2 rounded-lg text-center font-bold text-xs transition-all ${
            subTab === 'reports'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Reports ({feedbacks.length})
        </button>
      </div>

      {/* Log Content */}
      <div className="space-y-4">
        {subTab === 'dispatches' ? (
          completedAlarms.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-slate-500 font-medium">No completed dispatches found</p>
              <p className="text-slate-400 text-xs mt-1">Dispatches you complete on shift will appear in this log.</p>
            </div>
          ) : (
            completedAlarms.map(alarm => {
              const isExpanded = expandedAlarmId === alarm.id;
              const linkedFeedback = feedbacks.find(f => f.alarm_id === alarm.id);

              return (
                <div 
                  key={alarm.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div 
                    onClick={() => toggleAlarmExpand(alarm.id)} 
                    className="flex justify-between items-start gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {alarm.alarm_type || 'Alarm'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          alarm.priority === 'critical' ? 'bg-red-50 text-red-700 border border-red-100' :
                          alarm.priority === 'high' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          alarm.priority === 'medium' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {alarm.priority} priority
                        </span>
                        {alarm.vehicle_registration && (
                          <span className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                            <Car size={10} />
                            {alarm.vehicle_registration}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-base md:text-lg truncate">{alarm.client_name}</h4>
                      <p className="text-slate-500 text-xs flex items-center gap-1 truncate">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        {alarm.address}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded flex items-center gap-1 border border-slate-100 font-mono">
                        <Calendar size={10} />
                        {new Date(alarm.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-900 flex items-center gap-1">
                            <Info size={12} className="text-slate-400" />
                            Dispatch Details
                          </span>
                          <p className="text-slate-600 leading-relaxed font-sans mt-1">
                            {alarm.incident_details || "No original dispatch details provided."}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono block mt-2">
                            Dispatched At: {new Date(alarm.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="space-y-1.5 bg-emerald-50/20 p-3 rounded-xl border border-emerald-100/50">
                          <span className="font-bold text-emerald-800 flex items-center gap-1">
                            <FileText size={12} className="text-emerald-500" />
                            Your Submitted Report
                          </span>
                          {linkedFeedback ? (
                            <>
                              <p className="text-slate-700 leading-relaxed mt-1">
                                {linkedFeedback.feedback_text}
                              </p>
                              {linkedFeedback.image_analysis && (
                                <div className="mt-2.5 p-2 bg-white rounded-lg border border-emerald-100 flex items-start gap-1.5 text-[11px] text-emerald-700">
                                  <Sparkles size={12} className="text-emerald-500 shrink-0 mt-0.5 animate-pulse" />
                                  <div>
                                    <span className="font-bold">AI Image Verification: </span>
                                    <span>{linkedFeedback.image_analysis}</span>
                                  </div>
                                </div>
                              )}
                              {linkedFeedback.admin_response && (
                                <div className="mt-2.5 p-2 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-1.5 text-[11px] text-slate-800">
                                  <Sparkles size={12} className="text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">Management Response: </span>
                                    <span>{linkedFeedback.admin_response}</span>
                                  </div>
                                </div>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono block mt-2">
                                Submitted At: {new Date(linkedFeedback.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          ) : (
                            <p className="text-slate-400 italic mt-1">
                              No written report found for this dispatch.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          feedbacks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText size={24} />
              </div>
              <p className="text-slate-500 font-medium">No submitted incident reports found</p>
              <p className="text-slate-400 text-xs mt-1">Reports you submit after resolving an alarm will appear here.</p>
            </div>
          ) : (
            feedbacks.map(report => {
              const isExpanded = expandedReportId === report.id;
              const linkedAlarm = completedAlarms.find(a => a.id === report.alarm_id);

              return (
                <div 
                  key={report.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div 
                    onClick={() => toggleReportExpand(report.id)} 
                    className="flex justify-between items-start gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                          Report #{report.id}
                        </span>
                        {report.vehicle_registration && (
                          <span className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                            <Car size={10} />
                            {report.vehicle_registration}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-base md:text-lg truncate">{report.client_name}</h4>
                      <p className="text-slate-500 text-xs flex items-center gap-1 truncate">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        {report.address}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded flex items-center gap-1 border border-slate-100 font-mono">
                        <Calendar size={10} />
                        {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  <div className="mt-2.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100/70 whitespace-pre-wrap leading-relaxed">
                    {report.feedback_text}
                  </div>

                  {report.image_analysis && (
                    <div className="mt-2 p-2 bg-emerald-50/10 rounded-xl border border-emerald-100/40 flex items-start gap-1.5 text-[11px] text-emerald-800">
                      <Sparkles size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">AI Image Verification: </span>
                        <span>{report.image_analysis}</span>
                      </div>
                    </div>
                  )}

                  {report.admin_response && (
                    <div className="mt-2.5 p-3 bg-amber-50/50 rounded-xl border border-amber-100/60 flex items-start gap-2 text-xs text-slate-800">
                      <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-800 uppercase tracking-wider text-[10px] block mb-0.5">Management Response</span>
                        <p className="whitespace-pre-wrap font-medium">{report.admin_response}</p>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fadeIn">
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <Info size={12} className="text-slate-400" />
                          Associated Alarm Details
                        </span>
                        {linkedAlarm ? (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                            <div>
                              <span className="text-slate-400 text-[10px] block font-medium uppercase tracking-wider">Alarm Type</span>
                              <span className="font-semibold text-slate-800">{linkedAlarm.alarm_type || 'General'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block font-medium uppercase tracking-wider">Priority Level</span>
                              <span className="font-semibold text-slate-800 capitalize">{linkedAlarm.priority}</span>
                            </div>
                            <div className="col-span-2 mt-1">
                              <span className="text-slate-400 text-[10px] block font-medium uppercase tracking-wider">Incident Details</span>
                              <span className="text-slate-600 block mt-0.5 leading-relaxed">{linkedAlarm.incident_details || "No details provided."}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-400 italic mt-1">
                            Could not load linked alarm details.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
