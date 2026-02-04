import React from 'react';
import {
  Activity,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function ActivityList({ events, isOpen, toggle }) {
  return (
    <div className="accordion-wrapper">
      <button onClick={toggle} className="accordion-btn">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#8D6E63]" />
          <span className="text-sm font-bold text-[#3E2723]">
            최근 사냥 활동
          </span>
          {events.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
              !
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-stone-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400" />
        )}
      </button>

      {isOpen && (
        <div className="accordion-content space-y-2">
          {events.length > 0 ? (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2 bg-white rounded-lg border border-stone-100 shadow-sm"
              >
                <div
                  className={`p-1.5 rounded-full flex-shrink-0 ${event.type === 'scam' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}
                >
                  {event.type === 'scam' ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#3E2723] mb-0.5">
                    {event.msg}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {event.time} 감지됨
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-stone-400">
              아직 발견된 위협이 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
