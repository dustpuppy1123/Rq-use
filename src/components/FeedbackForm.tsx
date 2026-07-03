import React, { useState, useRef } from 'react';
import { Alarm, User, Vehicle } from '../types';
import { Camera, Send, X, Loader2, Image as ImageIcon, AlertCircle, Car } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface FeedbackFormProps {
  alarm: Alarm;
  user: User;
  vehicle: Vehicle;
  onComplete: () => void;
  onCancel: () => void;
}

export default function FeedbackForm({ alarm, user, vehicle, onComplete, onCancel }: FeedbackFormProps) {
  const [clientName, setClientName] = useState(alarm.client_name);
  const [address, setAddress] = useState(alarm.address);
  const [feedbackText, setFeedbackText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        analyzeImage(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64Image: string, mimeType: string) => {
    if (!navigator.onLine) {
      setImageAnalysis('Image attached. AI analysis is unavailable while offline.');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      // Initialize Gemini SDK
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const base64Data = base64Image.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: 'Analyze this image from a security call out. Describe what you see, any potential security risks, damage, or points of interest. Keep it concise and professional.',
            },
          ],
        },
      });

      setImageAnalysis(response.text || 'No analysis provided.');
    } catch (err) {
      console.error('Gemini Analysis Error:', err);
      setImageAnalysis('Failed to analyze image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      alarm_id: alarm.id,
      driver_id: user.id,
      vehicle_id: vehicle.id,
      client_name: clientName,
      address: address,
      feedback_text: feedbackText,
      image_analysis: imageAnalysis
    };

    const saveToIndexedDBQueue = (data: any) => {
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
              url: '/api/feedbacks',
              method: 'POST',
              body: data,
              headers: { 'Content-Type': 'application/json' },
              timestamp: Date.now(),
              type: 'feedback'
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

    const clearAndComplete = () => {
      setClientName('');
      setAddress('');
      setFeedbackText('');
      setImage(null);
      setImagePreview(null);
      setImageAnalysis('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoading(false);
      onComplete();
    };

    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      if (res.ok && responseData.queued) {
        // Intercepted and marked as queued offline by service worker
        clearAndComplete();
      } else if (res.ok) {
        clearAndComplete();
      } else {
        // Fallback to queue offline if server is unreachable or reports error
        console.warn('POST failed with status, queueing locally in IndexedDB.');
        await saveToIndexedDBQueue(payload).catch(console.error);
        clearAndComplete();
      }
    } catch (err) {
      console.warn('Network error occurred, queueing feedback locally in IndexedDB.', err);
      await saveToIndexedDBQueue(payload).catch(console.error);
      clearAndComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Call Out Feedback</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={24} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none bg-slate-50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none bg-slate-50"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Used</label>
          <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-medium">
            <Car size={18} className="text-slate-400" />
            {vehicle.registration}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Officer Feedback</label>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none min-h-[120px] bg-slate-50"
            placeholder="Describe the situation, actions taken, and current status..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Photo Evidence (Optional)</label>
          
          {!imagePreview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-rq-gold hover:text-rq-gold transition-colors cursor-pointer group"
            >
              <div className="w-12 h-12 bg-slate-100 group-hover:bg-rq-gold/20 rounded-full flex items-center justify-center mb-3 transition-colors">
                <Camera size={24} />
              </div>
              <p className="font-medium">Tap to take photo or upload</p>
              <p className="text-xs mt-1 opacity-70">Image will be analyzed by AI</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                    setImageAnalysis('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 backdrop-blur-sm transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex flex-col gap-2 text-white">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={14} />
                    <span className="text-xs font-medium">
                      {isAnalyzing ? 'Analyzing image...' : 'Image analyzed'}
                    </span>
                  </div>
                  {isAnalyzing && (
                    <div className="w-full bg-white/30 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-rq-gold h-1.5 rounded-full w-full animate-[progress_2s_ease-in-out_infinite]" style={{ transformOrigin: 'left' }}></div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span>AI Image Analysis</span>
                  {isAnalyzing && <Loader2 size={14} className="animate-spin text-rq-gold" />}
                </label>
                <textarea
                  value={imageAnalysis}
                  onChange={(e) => setImageAnalysis(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none min-h-[100px] bg-slate-50 disabled:opacity-70"
                  placeholder={isAnalyzing ? "Analyzing image..." : "AI analysis will appear here. You can edit it if needed."}
                />
              </div>
            </div>
          )}
          
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rq-dark text-white py-3.5 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing & Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
