import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal, Smartphone } from 'lucide-react';

interface PhoneContainerProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  isSimulatedOnly?: boolean; // If true, always holds the phone chassis size even on wider monitors
}

export default function PhoneContainer({ children, title, className = '', isSimulatedOnly = false }: PhoneContainerProps) {
  const [timeStr, setTimeStr] = useState('12:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      let minutes = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Responsive device container wrapper:
  // On md screens (desktop), it renders as a beautiful physical phone frame.
  // On mobile screens, it renders 100% full height and width smoothly.
  const frameClasses = isSimulatedOnly
    ? `relative w-full max-w-[390px] h-[844px] bg-slate-50 border-[12px] border-slate-900 rounded-[50px] shadow-2xl overflow-hidden flex flex-col ring-4 ring-slate-800/10 mx-auto aspect-[390/844]`
    : `relative w-full md:max-w-[390px] md:h-[844px] bg-slate-50 md:border-[12px] md:border-slate-900 md:rounded-[50px] md:shadow-2xl overflow-hidden flex flex-col md:ring-4 md:ring-slate-800/10 md:mx-auto md:aspect-[390/844] min-h-screen md:min-h-0`;

  const topNotchClass = isSimulatedOnly 
    ? "absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-full z-50 flex items-center justify-center pointer-events-none"
    : "hidden md:block absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-full z-50 flex items-center justify-center pointer-events-none";

  const statusBarClass = isSimulatedOnly
    ? "bg-white text-slate-800 px-6 pt-3 pb-1.5 flex justify-between items-center text-[11px] font-bold tracking-tight select-none border-b border-slate-150 shrink-0 z-40"
    : "bg-white text-slate-800 px-6 pt-3 pb-1.5 flex md:justify-between justify-end items-center text-[11px] font-bold tracking-tight select-none border-b border-slate-150 shrink-0 z-40";

  const bottomIndicatorClass = isSimulatedOnly
    ? "flex justify-center items-center bg-white py-2 shrink-0 z-40 border-t border-slate-100"
    : "hidden md:flex justify-center items-center bg-white py-2 shrink-0 z-40 border-t border-slate-100";

  return (
    <div className={`flex flex-col items-center justify-center ${isSimulatedOnly ? '' : 'min-h-screen bg-slate-900/10 md:bg-slate-900/5 py-4 pl-0 pr-0 md:py-8'}`}>
      <div className={frameClasses}>
        {/* Physical Ear Speaker & Camera Lens (Dynamic Island simulated mockup) */}
        <div className={topNotchClass}>
          {/* Camera Pin Hole */}
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 absolute left-4 border border-slate-950"></div>
          {/* Indicator Light */}
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950 absolute right-4"></div>
        </div>

        {/* Dynamic Hardware/Battery Status and System clock bar */}
        <div className={statusBarClass}>
          {(!isSimulatedOnly) && (
            <span className="font-semibold text-[12px] md:inline hidden">{timeStr}</span>
          )}
          {isSimulatedOnly && (
            <span className="font-semibold text-[12px]">{timeStr}</span>
          )}
          
          <div className="flex items-center gap-1.5 text-slate-700">
            <Signal size={12} className="stroke-[2.5]" />
            <span className="text-[9px] font-extrabold uppercase mr-0.5">5G</span>
            <Wifi size={12} className="stroke-[2.5]" />
            <Battery size={15} className="stroke-[2]" />
          </div>
        </div>

        {/* Simulated Display viewport */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 relative flex flex-col scrollbar-thin ${className}`}>
          {children}
        </div>

        {/* Simulated iOS/Android home capacitive system swipe indicator */}
        <div className={bottomIndicatorClass}>
          <div className="w-28 h-1 bg-slate-950 rounded-full opacity-80"></div>
        </div>
      </div>

      {title && (
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-2 p-1 bg-slate-100/50 rounded px-2">
          {title}
        </span>
      )}
    </div>
  );
}
