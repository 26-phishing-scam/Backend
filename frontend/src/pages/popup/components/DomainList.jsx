import React from 'react';
import { Globe, ChevronDown, ChevronUp } from 'lucide-react';

export default function DomainList({ domains, isOpen, toggle }) {
  return (
    <div className="accordion-wrapper">
      <button onClick={toggle} className="accordion-btn">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#8D6E63]" />
          <span className="text-sm font-bold text-[#3E2723]">
            최근 방문한 도메인
          </span>
          <span className="bg-[#8D6E63] text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {domains.length}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-stone-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400" />
        )}
      </button>

      {isOpen && (
        <div className="accordion-content">
          <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
            {domains.length > 0 ? (
              domains.map((item) => (
                <div key={item.id} className="list-item group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${item.safe ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    />
                    <span
                      className={`text-xs truncate max-w-[160px] font-medium ${!item.safe ? 'text-rose-600' : 'text-[#5D4037]'}`}
                    >
                      {item.url}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-400 whitespace-nowrap">
                    {item.time}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-stone-400">
                아직 도메인 기록이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
