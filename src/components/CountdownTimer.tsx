'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, started: false });

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate + 'T00:00:00').getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        started: true,
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!timeLeft.started) return null;

  const units = [
    { label: 'days', val: timeLeft.days },
    { label: 'hrs', val: timeLeft.hours },
    { label: 'min', val: timeLeft.minutes },
    { label: 'sec', val: timeLeft.seconds },
  ];

  return (
    <div className="flex items-center gap-6">
      {units.map(({ label, val }) => (
        <div key={label} className="text-center">
          <div className="text-3xl font-bold tabular-nums leading-none">{String(val).padStart(2, '0')}</div>
          <div className="text-xs text-zinc-400 mt-1 uppercase tracking-wide">{label}</div>
        </div>
      ))}
    </div>
  );
}
