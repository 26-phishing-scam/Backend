import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import './Popup.css';
import { initialDomains, initialEvents } from './popupData';
import PopupHeader from './components/PopupHeader';
import ControlPanel from './components/ControlPanel';
import DomainList from './components/DomainList';
import ActivityList from './components/ActivityList';
import { apiFetch } from '../../lib/api';

export default function Popup() {
  const [status, setStatus] = useState('running');
  const [domains, setDomains] = useState(initialDomains);
  const [events, setEvents] = useState(initialEvents);

  const [isDomainsOpen, setIsDomainsOpen] = useState(true);
  const [isEventsOpen, setIsEventsOpen] = useState(true);

  // 리포트 페이지 열기 (새 창 팝업 모드)
  const handleOpenReport = () => {
    if (typeof chrome !== 'undefined' && chrome.windows) {
      const reportUrl = chrome.runtime.getURL('report.html');
      chrome.windows.create({
        url: reportUrl,
        type: 'popup',
        width: 1200,
        height: 850,
        focused: true,
      });
    } else {
      window.open(
        '/report.html',
        'PeaceNyangReport',
        'width=1200,height=850,scrollbars=yes',
      );
    }
  };

  const hasChromeStorage =
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local;

  const typeLabel = (type) => {
    if (type === 'pii_input') return '개인정보 입력 시도';
    if (type === 'payment') return '결제 시도';
    if (type === 'download') return '다운로드 시도';
    if (type === 'phishing' || type === 'ai_phishing') return 'AI phishing';
    return '이상 행위 감지';
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}일 전`;
  };

  useEffect(() => {
    let cancelled = false;

    if (hasChromeStorage) {
      chrome.storage.local.get(['monitoring'], (res) => {
        if (cancelled) return;
        setStatus(res.monitoring || 'running');
      });
    }

    const fetchData = async () => {
      try {
        const [domainsRes, eventsRes] = await Promise.all([
          apiFetch('/domains'),
          apiFetch('/events'),
        ]);

        if (cancelled) return;

        const domainItems = (domainsRes.domains || []).map((d, idx) => ({
          id: `d-${idx}`,
          url: d.domain,
          safe: true,
          time: formatTime(d.ts),
        }));

        const eventItems = (eventsRes.events || []).map((ev, idx) => {
          const kind =
            ev.type === 'download' || ev.type === 'payment' ? 'scam' : 'phishing';
          return {
            id: ev.ts || `e-${idx}`,
            type: kind,
            msg: `${typeLabel(ev.type)} · ${ev.url}`,
            time: formatTime(ev.ts),
          };
        });

        setDomains(domainItems);
        setEvents(eventItems);
      } catch {
        if (cancelled) return;
      }
    };

    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hasChromeStorage]);

  const handleReset = async () => {
    if (!window.confirm('피스냥의 사냥 기록을 초기화 하시겠습니까?')) return;

    if (hasChromeStorage) {
      await chrome.storage.local.remove(['events', 'domains']);
      setDomains([]);
      setEvents([]);
      return;
    }

    setDomains([]);
    setEvents([]);
  };

  const handleSetStatus = async (next) => {
    setStatus(next);
    if (hasChromeStorage) {
      await chrome.storage.local.set({ monitoring: next });
    }
  };

  return (
    <div className="popup-container custom-scrollbar">
      {/* 1. 헤더 */}
      <PopupHeader status={status} />

      {/* 2. 컨트롤 패널 */}
      <ControlPanel
        status={status}
        setStatus={handleSetStatus}
        onReset={handleReset}
      />

      {/* 3. 도메인 리스트 */}
      <DomainList
        domains={domains}
        isOpen={isDomainsOpen}
        toggle={() => setIsDomainsOpen(!isDomainsOpen)}
      />

      {/* 4. 활동 리스트 */}
      <ActivityList
        events={events}
        isOpen={isEventsOpen}
        toggle={() => setIsEventsOpen(!isEventsOpen)}
      />

      {/* 5. 리포트 이동 버튼 */}
      <button onClick={handleOpenReport} className="report-btn">
        <span>상세 리포트 보기</span>
        <ExternalLink className="w-4 h-4" />
      </button>
    </div>
  );
}
