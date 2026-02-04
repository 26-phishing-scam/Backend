import React from 'react';
import {
  Shield,
  AlertTriangle,
  X,
  Search,
  Fingerprint,
  Clock,
  Hash,
} from 'lucide-react';
import '../Report.css';

export default function DetailModal({ threat, onClose }) {
  if (!threat) return null;

  // 태그 및 아이콘 스타일 설정
  const tagClass = threat.type === 'phishing' ? 'tag-phishing' : 'tag-scam';
  const iconColor =
    threat.type === 'phishing' ? 'text-[#f59e0b]' : 'text-[#f43f5e]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#FFF8F6] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20 scale-100 animate-in zoom-in-95 duration-200">
        {/* 모달 헤더 */}
        <div className="bg-[#3E2723] p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              {threat.type === 'phishing' ? (
                <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
              ) : (
                <Shield className={`w-6 h-6 ${iconColor}`} />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {threat.type === 'phishing'
                  ? '피싱 의심 탐지'
                  : '스캠 위험 감지'}
              </h3>
              <p className="text-sm text-white/70">
                {threat.timestamp}에 차단됨
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 모달 내용 */}
        <div className="p-6 space-y-6">
          {/* URL & 태그 */}
          <div className="bg-white p-4 rounded-xl border border-[#f5f5f4] shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className={`threat-tag ${tagClass}`}>
                <Hash className="w-3 h-3" />
                {threat.tag}
              </span>
              <span className="text-xs text-[#a8a29e]">ID: {threat.id}</span>
            </div>
            <p className="text-lg font-bold text-[#3E2723] break-all">
              {threat.url}
            </p>
            <p className="text-sm text-[#78716c] mt-1">{threat.description}</p>
          </div>

          {/* 상세 분석 내용 */}
          <div>
            <h4 className="text-sm font-bold text-[#5D4037] flex items-center gap-2 mb-3">
              <Search className="w-4 h-4" />
              피스냥 분석 결과
            </h4>
            <div className="bg-[#3E2723]/5 p-4 rounded-xl text-sm text-[#3E2723] leading-relaxed">
              {threat.analysis ||
                '해당 사이트는 피스냥의 AI 엔진에 의해 유해 사이트로 분류되었습니다.'}
            </div>
          </div>

          {/* 기술 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-xl border border-[#f5f5f4]">
              <div className="text-xs text-[#a8a29e] mb-1 flex items-center gap-1">
                <Fingerprint className="w-3 h-3" /> 감지 IP
              </div>
              <div className="text-sm font-bold text-[#44403c]">
                {threat.ip || '정보 없음'}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#f5f5f4]">
              <div className="text-xs text-[#a8a29e] mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 감지 시간
              </div>
              <div className="text-sm font-bold text-[#44403c]">
                {threat.timestamp}
              </div>
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="p-4 bg-[#f5f5f4] text-center">
          <button
            onClick={onClose}
            className="w-full bg-[#3E2723] text-white font-bold py-3 rounded-xl hover:bg-[#2D1B15] transition-colors shadow-lg"
          >
            확인했습니다 🐾
          </button>
        </div>
      </div>
    </div>
  );
}
