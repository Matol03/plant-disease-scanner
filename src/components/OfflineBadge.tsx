import React, { useEffect, useState } from 'react';
import './OfflineBadge.css';

export const OfflineBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`offline-badge ${!isOnline ? 'offline-badge--offline' : 'offline-badge--online'}`}>
      <span className={`offline-badge__dot ${!isOnline ? 'offline-badge__dot--pulse' : ''}`} />
      <span className="offline-badge__text">
        {isOnline ? 'Online' : 'Offline Mode'}
      </span>
    </div>
  );
};
