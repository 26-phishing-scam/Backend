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
import { mockThreats } from './reportData';
import ThreatCard from './components/ThreatCard';
import DetailModal from './components/DetailModal';
import { API_BASE_URL, apiFetch } from '../../lib/api';

export default function Report() {
  const dashboardRef = useRef(null);

  const [selectedThreat, setSelectedThreat] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [summary, setSummary] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // 서버 summary 기반 상단 통계
  const [stats, setStats] = useState({
    totalBaits: 0,
    phishingBlocked: 0,
    scamsPrevented: 0,
  });

  // summary.events 기반으로 표시 (없으면 mock)
  const [threats, setThreats] = useState(mockThreats);

  const formatTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}일 전`;
  };

  const toThreatType = (eventType) => {
    if (['pii_input', 'download', 'payment', 'clipboard', 'redirect'].includes(eventType)) {
      return 'scam';
    }
    return 'phishing';
  };


  const eventTag = (eventType) => {
    if (eventType === 'pii_input') return '개인정보 입력';
    if (eventType === 'payment') return '결제 시도';
    if (eventType === 'download') return '다운로드';
    if (eventType === 'login') return '로그인';
    if (eventType === 'password_input') return '비밀번호';
    if (eventType === 'clipboard') return '클립보드';
    if (eventType === 'redirect') return '리다이렉트';
    if (eventType === 'form_submit') return '폼 제출';
    return '의심 활동';
  };

  const reasonLabel = (reason) => {
    if (reason === 'pii_input') return '개인정보 입력';
    if (reason === 'pii_fields_present') return '개인정보 필드 감지';
    if (reason === 'multiple_pii_fields') return '다중 개인정보 필드';
    if (reason === 'ssn_present') return '주민등록번호 감지';
    if (reason === 'phone_present') return '전화번호 감지';
    if (reason === 'email_present') return '이메일 감지';
    if (reason === 'address_present') return '주소 감지';
    if (reason === 'card_present') return '카드 정보 감지';
    if (reason === 'payment_amount_present') return '결제 금액 감지';
    if (reason === 'card_bin_present') return '카드 BIN 감지';
    if (reason === 'merchant_domain_present') return '가맹점 도메인 감지';
    if (reason === 'download_risky_extension') return '위험한 확장자 다운로드';
    if (reason === 'download_from_new_domain') return '새 도메인 다운로드';
    if (reason === 'form_action_domain_mismatch') return '폼 도메인 불일치';
    if (reason === 'password_present') return '비밀번호 입력 감지';
    if (reason === 'clipboard_write') return '클립보드 쓰기 감지';
    if (reason === 'crypto_address_present') return '암호화폐 주소 감지';
    if (reason === 'redirect_chain_long') return '리다이렉트 체인 길음';
    if (reason === 'redirect_final_domain_present') return '최종 도메인 감지';
    if (reason === 'file_upload_present') return '파일 업로드 감지';
    if (reason === 'payment_fields_present') return '결제 필드 감지';
    if (reason === 'meta_missing') return '메타 정보 누락';
    return reason;
  };

  const eventDescription = (ev) => {
    if (Array.isArray(ev?.reasons) && ev.reasons.length) {
      return ev.reasons.map(reasonLabel).join(', ');
    }
    return '세부 분석 정보를 불러오지 못했습니다.';
  };

  const mapEventToThreat = (ev, idx) => ({
    id: ev?.ts || `e-${idx}`,
    type: toThreatType(ev?.type),
    tag: eventTag(ev?.type),
    timestamp: formatTime(ev?.ts),
    url: ev?.url || '',
    description: eventDescription(ev),
    analysis: eventDescription(ev),
  });

  const normalizeThreat = (item, idx) => {
    if (item && item.tag && item.timestamp && item.url) {
      return item;
    }
    return mapEventToThreat(item, idx);
  };

  const normalizedThreats = threats.map(normalizeThreat);
  const phishingThreats = normalizedThreats.filter((t) => t.type === 'phishing');
  const scamThreats = normalizedThreats.filter((t) => t.type === 'scam');

  const computeStatsFromEvents = (items) => {
    const total = items.length;
    const phishing = items.filter((e) => e.type === 'login' || e.type === 'password_input' || e.type === 'form_submit').length;
    const scam = items.filter((e) => e.type === 'pii_input' || e.type === 'download' || e.type === 'payment' || e.type === 'clipboard' || e.type === 'redirect').length;
    return {
      totalBaits: total,
      phishingBlocked: phishing,
      scamsPrevented: scam,
    };
  };

  /* summary → stats 매핑 */
  const mapSummaryToStats = (data) => {
    if (!data || !data.summary) return null;
    const s = data.summary;

    return {
      totalBaits: s.total_events ?? 0,
      phishingBlocked: s.form_action_domain_mismatch_events ?? 0,
      scamsPrevented:
        (s.risky_download_events ?? 0) +
        (s.payment_fields_events ?? 0) +
        (s.crypto_address_events ?? 0),
    };
  };

  /* API Health Check */
  useEffect(() => {
    let cancelled = false;

    apiFetch('/health')
      .then((data) => {
        if (!cancelled) {
          setApiStatus(data?.status === 'ok' ? 'online' : 'offline');
        }
      })
      .catch(() => {
        if (!cancelled) setApiStatus('offline');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Batch Analyze */
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [summaryRes, eventsRes] = await Promise.all([
          apiFetch('/summary'),
          apiFetch('/events'),
        ]);

        if (cancelled) return;

        setSummary(summaryRes.summary || null);
        const items = eventsRes.events || [];
        const mappedThreats = items.map(mapEventToThreat);
        setThreats(mappedThreats);

        const mapped = mapSummaryToStats(summaryRes);
        if (mapped) {
          setStats(mapped);
        } else {
          setStats(computeStatsFromEvents(items));
        }
      } catch (err) {
        if (!cancelled) setSyncError(err.message || 'sync_failed');
      }
    };

    fetchData();
    const id = setInterval(fetchData, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  /* PDF Download */
  const downloadPDF = async () => {
    const element = dashboardRef.current;
    if (!element) {
      alert('오류: 리포트 영역을 찾을 수 없습니다.');
      return;
    }

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: '#B8845F',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
    });

    overlay.innerHTML = `
      <style>
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      </style>
      <div style="margin-bottom:30px; animation:bounce 1s infinite;">
        <img src="/icon.png" alt="로딩 아이콘"
          style="width:160px;height:160px;object-fit:contain;
          filter:drop-shadow(0 10px 15px rgba(0,0,0,0.2));" />
      </div>
      <div style="font-size:32px;font-weight:800;">리포트 생성 중…</div>
      <div style="font-size:18px;opacity:.9;margin-top:12px;">잠시만 기다려주세요</div>
    `;

    document.body.appendChild(overlay);

    const btn = document.getElementById('save-btn');
    if (btn) btn.style.display = 'none';

    await new Promise((r) => setTimeout(r, 100));

    try {
      const standardWidth = 1200;

      element.style.width = `${standardWidth}px`;
      element.style.margin = '0';
      element.style.padding = '20px';

      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#B8845F',
        width: standardWidth,
        height: element.scrollHeight,
        pixelRatio: 2,
      });

      const pdfWidth = 210;
      const pdfHeight = (element.scrollHeight * pdfWidth) / standardWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`스캠_리포트_${new Date().toLocaleDateString('ko-KR')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      if (btn) btn.style.display = 'flex';
      document.body.removeChild(overlay);
    }
  };

  return (
    <div className="report-page-bg p-8">
      <div ref={dashboardRef} className="max-w-7xl mx-auto p-4">

        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <img src="/icon.png" alt="로딩 아이콘" />

              <div>
                <h1 className="text-4xl font-black text-white">스캠</h1>
                <p className="text-sm text-white/80">
                  실시간 피싱·스캠 행위 감지
                </p>

                <div className={`api-status api-${apiStatus}`}>
                  API {apiStatus}
                </div>

                {summary && (
                  <div className="api-status api-online">
                    Events: {summary.total_events}
                  </div>
                )}

                {syncError && (
                  <div className="api-status api-offline">
                    Sync error: {syncError}
                  </div>
                )}
              </div>
            </div>

            <button
              id="save-btn"
              onClick={downloadPDF}
              className="flex items-center gap-2 bg-white px-6 py-3 rounded-xl font-bold"
            >
              <Download className="w-5 h-5" />
              리포트 저장
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="전체 이벤트"
            value={stats.totalBaits}
            icon={<Sparkles />}
          />
          <StatCard
            title="피싱 차단"
            value={stats.phishingBlocked}
            icon={<AlertTriangle />}
          />
          <StatCard
            title="스캠 예방"
            value={stats.scamsPrevented}
            icon={<Shield />}
          />
        </div>

        {/* Threat Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ThreatList
            title="피싱"
            icon={<AlertTriangle />}
            items={phishingThreats}
            onClick={setSelectedThreat}
          />
          <ThreatList
            title="스캠"
            icon={<Shield />}
            items={scamThreats}
            onClick={setSelectedThreat}
          />
        </div>
      </div>

      <DetailModal
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />
    </div>
  );
}

/* Small Components */

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-[#FFF8F6] rounded-3xl p-6 shadow">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="font-bold">{title}</h3>
      </div>
      <p className="text-5xl font-black">{value}</p>
    </div>
  );
}

function ThreatList({ title, icon, items, onClick }) {
  return (
    <div className="threat-list-container">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h2 className="text-2xl font-black">{title}</h2>
        <span className="ml-auto">{items.length}건</span>
      </div>
      <div>
        {items.map((t) => (
          <ThreatCard key={t.id} threat={t} onClick={onClick} />
        ))}
      </div>
    </div>
  );
}

