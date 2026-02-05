import React, { useEffect, useState, useRef } from 'react';
import {
  Shield,
  AlertTriangle,
  Download,
  Sparkles,
  CreditCard,
  Lock,
  Mail,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

import './Report.css';
import ThreatCard from './components/ThreatCard';
import DetailModal from './components/DetailModal';
import { mockThreats } from './reportData';
import { apiFetch } from '../../lib/api';

export default function Report() {
  const dashboardRef = useRef(null);

  const [selectedThreat, setSelectedThreat] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [summary, setSummary] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const [stats, setStats] = useState({
    totalBaits: 0,
    phishingBlocked: 0,
    scamsPrevented: 0,
  });

  const [threats, setThreats] = useState(mockThreats);

  /* ================= Utils ================= */

  const EVENT_LABEL = {
    phishing: 'AI phishing detected',
    ai_phishing: 'AI phishing detected',
    pii_input: '개인정보 입력',
    pii_fields_present: '개인정보 입력 감지',
    multiple_pii_fields: '다수 개인정보 입력',
    ssn_present: '주민등록번호 입력',
    phone_present: '전화번호 입력',
    email_present: '이메일 입력',
    address_present: '주소 입력',

    password_input: '비밀번호 입력',
    login: '로그인 시도',

    payment: '결제 시도',
    payment_fields_present: '결제 정보 입력',
    card_present: '카드 정보 입력',

    download: '파일 다운로드',
    download_risky_extension: '위험한 파일 다운로드',
    download_from_new_domain: '새 도메인 다운로드',

    clipboard: '클립보드 접근',
    clipboard_write: '클립보드 변경',

    redirect: '의심스러운 리다이렉트',
    redirect_chain_long: '리다이렉트 반복',

    form_submit: '폼 제출',
    form_action_domain_mismatch: '폼 도메인 불일치',
  };

  const labelOf = (code) => EVENT_LABEL[code] || code || 'unknown';

  const formatTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    return `${Math.floor(diffHr / 24)}일 전`;
  };

  const toThreatType = (eventType) =>
    ['pii_input', 'download', 'payment', 'clipboard', 'redirect'].includes(eventType)
      ? 'scam'
      : 'phishing';

  const mapEventToThreat = (ev, idx) => ({
    id: ev?.ts || `e-${idx}`,
    type: toThreatType(ev?.type),
    tag: labelOf(ev?.type),
    timestamp: formatTime(ev?.ts),
    url: ev?.url || '',
    description: Array.isArray(ev?.reasons)
      ? ev.reasons.map(labelOf).join(', ')
      : '의심 행위 감지',
    analysis: Array.isArray(ev?.reasons)
      ? ev.reasons.map(labelOf).join(', ')
      : '',
  });

  const phishingThreats = threats.filter((t) => t.type === 'phishing');
  const scamThreats = threats.filter((t) => t.type === 'scam');

  /* ================= API ================= */

  useEffect(() => {
    apiFetch('/health')
      .then((d) => setApiStatus(d?.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [summaryRes, eventsRes] = await Promise.all([
          apiFetch('/summary'),
          apiFetch('/events'),
        ]);

        if (cancelled) return;

        setSummary(summaryRes?.summary || null);

        const items = eventsRes?.events || [];
        const mappedThreats = items.map(mapEventToThreat);

        setThreats(mappedThreats);

        setStats({
          totalBaits: mappedThreats.length,
          phishingBlocked: mappedThreats.filter((t) => t.type === 'phishing').length,
          scamsPrevented: mappedThreats.filter((t) => t.type === 'scam').length,
        });
      } catch (e) {
        if (!cancelled) setSyncError(e.message || 'sync_failed');
      }
    };

    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  /* ================= PDF ================= */

  const downloadPDF = async () => {
    const element = dashboardRef.current;
    if (!element) return;

    const btn = document.getElementById('save-btn');
    if (btn) btn.style.display = 'none';

    try {
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#B8845F',
        pixelRatio: 2,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      pdf.save(`스캠_리포트_${new Date().toLocaleDateString('ko-KR')}.pdf`);
    } finally {
      if (btn) btn.style.display = 'flex';
    }
  };

  /* ================= Render ================= */

  return (
    <div className="report-page-bg p-8">
      <div ref={dashboardRef} className="max-w-7xl mx-auto p-4">

        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-[#fbbf24] blur-xl opacity-20 rounded-full"></div>
                <img src="/icon.png" className="w-16 h-16 object-contain relative z-10" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white">스캠</h1>
                <p className="text-sm text-white/80">실시간 피싱·스캠 행위 감지</p>

                <div className={`api-status api-${apiStatus}`}>
                  API {apiStatus}
                </div>

                {syncError && (
                  <div className="api-status api-offline">
                    Sync error
                  </div>
                )}
              </div>
            </div>

            <button
              id="save-btn"
              onClick={downloadPDF}
              className="flex items-center gap-2 bg-white text-[#3E2723] px-6 py-3 rounded-xl shadow-lg font-bold"
            >
              <Download className="w-5 h-5" />
              리포트 저장
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="전체 이벤트" value={stats.totalBaits} icon={<Sparkles />} />
          <StatCard title="피싱 차단" value={stats.phishingBlocked} icon={<AlertTriangle />} />
          <StatCard title="스캠 예방" value={stats.scamsPrevented} icon={<Shield />} />
        </div>

        {/* Threat Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ThreatList title="피싱" icon={<AlertTriangle />} items={phishingThreats} onClick={setSelectedThreat} />
          <ThreatList title="스캠" icon={<Shield />} items={scamThreats} onClick={setSelectedThreat} />
        </div>

        {/* Safety Tips */}
        <SafetyTips />
      </div>

      <DetailModal threat={selectedThreat} onClose={() => setSelectedThreat(null)} />
    </div>
  );
}

/* ================= Components ================= */

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-[#FFF8F6] rounded-3xl p-6 shadow-xl border border-white/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-[#3E2723] p-2.5 rounded-xl text-[#fbbf24]">
          {icon}
        </div>
        <h3 className="font-bold text-[#5D4037]">{title}</h3>
      </div>
      <p className="text-5xl font-black text-[#3E2723]">{value}</p>
    </div>
  );
}

function ThreatList({ title, icon, items, onClick }) {
  return (
    <div className="threat-list-container flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        {icon}
        <h2 className="text-2xl font-black">{title}</h2>
        <span className="ml-auto">{items.length}건</span>
      </div>

      {/* 리스트 영역 (스크롤) */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {items.map((t) => (
          <ThreatCard key={t.id} threat={t} onClick={onClick} />
        ))}
      </div>
    </div>
  );
}


function SafetyTips() {
  return (
    <div className="bg-[#2D1B15]/30 backdrop-blur-md rounded-3xl p-8 mt-8">
      <h2 className="text-3xl font-black text-white mb-6">안전 팁 🐱</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Tip icon={<CreditCard />} title="카드 정보 주의" />
        <Tip icon={<Lock />} title="URL 확인" />
        <Tip icon={<Mail />} title="출처 확인" />
      </div>
    </div>
  );
}

function Tip({ icon, title }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h3 className="font-bold">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">의심되면 절대 입력하지 마세요.</p>
    </div>
  );
}
