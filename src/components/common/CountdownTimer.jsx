import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function CountdownTimer({ initialMinutes = 60, onTimeUp, isActive = true }) {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);

  useEffect(() => {
    setSecondsLeft(initialMinutes * 60);
  }, [initialMinutes]);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onTimeUp) onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onTimeUp]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 300; // under 5 minutes

  return (
    <div 
      className={`badge ${isUrgent ? 'badge-red' : 'badge-neutral'}`}
      style={{ 
        fontFamily: 'var(--font-mono)', 
        fontSize: 13, 
        padding: '4px 10px',
        color: isUrgent ? 'var(--accent-red)' : 'var(--text-primary)',
        borderColor: isUrgent ? 'rgba(212, 76, 71, 0.4)' : 'var(--border-default)'
      }}
    >
      <Clock size={14} />
      <span>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} remaining</span>
    </div>
  );
}
