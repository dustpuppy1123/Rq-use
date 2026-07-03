import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface AddressSuggestion {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (val: string, lat?: number, lng?: number) => void;
}

export default function AddressAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const fetchSuggestions = async (search: string) => {
    if (!search || search.length < 4) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find addresses matching: "${search}". ONLY return locations within the African continent. Return a JSON array of up to 5 objects. Each object must have 'address' (full address string), 'lat' (latitude number), and 'lng' (longitude number). Do not include any markdown formatting, just the raw JSON array.`
      });
      
      const text = response.text || '';
      try {
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          setSuggestions(parsed);
          setIsOpen(true);
        }
      } catch (e) {
        console.error('Failed to parse address JSON', e);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 800);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    setQuery(suggestion.address);
    onChange(suggestion.address, suggestion.lat, suggestion.lng);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin size={18} className="text-slate-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rq-gold outline-none bg-slate-50"
          placeholder="Start typing an address..."
          required
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 size={18} className="animate-spin text-rq-gold" />
          </div>
        )}
      </div>
      
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <div 
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0 flex items-start gap-3"
            >
              <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{s.address}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
