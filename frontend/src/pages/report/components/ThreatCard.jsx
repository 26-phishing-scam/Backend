import React from 'react';
import { Clock, ChevronRight, Hash } from 'lucide-react';
import '../Report.css';

export default function ThreatCard({ threat, onClick }) {
  // 위협 타입에 따라 태그 색상 결정 (피싱 vs 스캠)
  const tagClass = threat.type === 'phishing' ? 'tag-phishing' : 'tag-scam';
  const iconClass = threat.type === 'phishing' ? 'icon-phishing' : 'icon-scam';

  return (
    <div onClick={() => onClick(threat)} className="threat-card group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`threat-tag ${tagClass}`}>
              <Hash className="w-3 h-3" />
              {threat.tag}
            </span>
            <div className="flex items-center text-xs text-[#a8a29e] font-medium">
              <Clock className="w-3 h-3 mr-1" />
              {threat.timestamp}
            </div>
          </div>
          <p className="text-sm text-[#292524] font-bold break-all mb-1 group-hover:text-[#78350f] transition-colors">
            {threat.url}
          </p>
          <p className="text-xs text-[#78716c] truncate">
            {threat.description}
          </p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center ml-2">
          <ChevronRight className={`w-5 h-5 ${iconClass}`} />
        </div>
      </div>
    </div>
  );
}
