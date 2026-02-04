import React from 'react';
import { getStatusInfo } from '../popupData';

export default function PopupHeader({ status }) {
  const info = getStatusInfo(status);

  return (
    <header className="popup-header">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src="/icon.png"
            alt="Logo"
            className="w-10 h-10 object-contain drop-shadow-md"
          />
          {status === 'active' && <span className="pulse-dot"></span>}
        </div>
        <div>
          <h1 className="text-xl font-black text-white leading-none">피스냥</h1>
          <p className="text-xs text-white/90 mt-1 font-medium">{info.text}</p>
        </div>
      </div>
      <div className={`status-badge ${info.className}`}>{info.label}</div>
    </header>
  );
}
