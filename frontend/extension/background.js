// ====== 설정/상수 ======
const API_BASE = "http://localhost:8000"; // 백엔드(분석 서버) 주소
const EVENTS_KEY = "events";              // 로컬스토리지에 이벤트 저장할 키
const DOMAINS_KEY = "domains";            // 로컬스토리지에 도메인 저장할 키
const MONITORING_KEY = "monitoring";      // 모니터링 상태(running/paused/stopped) 저장 키
const MAX_EVENTS = 100;                   // 이벤트 리스트 최대 개수
const MAX_DOMAINS = 50;                   // 도메인 리스트 최대 개수
const DOWNLOAD_EXTENSIONS = ["exe","zip","dmg","apk","msi","pdf"]; // 다운로드 감지 확장자 필터

let monitoringState = "running";          // 현재 모니터링 상태(기본 running)


// chrome.storage.local.get 래퍼: key 없으면 fallback 반환
async function readStore(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback;
}

// chrome.storage.local.set 래퍼: key/value 저장
async function writeStore(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// ====== URL -> 도메인 추출 ======
// www 제거하고 hostname만 반환(실패하면 "")
function toDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ====== 도메인 기록 ======
// 새 도메인을 맨 앞에 추가하고 중복 제거 후 MAX_DOMAINS로 자르기
async function addDomain(url) {
  const domain = toDomain(url);
  if (!domain) return;
  const domains = await readStore(DOMAINS_KEY, []);
  const next = [domain, ...domains.filter((d) => d !== domain)].slice(0, MAX_DOMAINS);
  await writeStore(DOMAINS_KEY, next);
  try {
    await postDomain(url);
  } catch {
    // ignore API errors for domains
  }
}

// ====== 이벤트 기록(content.js 메시지 기반 이벤트) ======
// 이벤트(엔트리)를 맨 앞에 추가하고 MAX_EVENTS로 자르기
async function addEvent(entry) {
  const events = await readStore(EVENTS_KEY, []);
  const next = [entry, ...events].slice(0, MAX_EVENTS);
  await writeStore(EVENTS_KEY, next);
  try {
    await postStoredEvent(entry);
  } catch {
    // ignore API errors for events
  }
}

// ====== 서버 분석 요청 ======
// FastAPI로 이벤트 분석 요청을 보내고, reasons 등의 분석 결과 JSON을 돌려받음
async function postEvent(payload) {
  const response = await fetch(`${API_BASE}/analyze/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

async function postStoredEvent(entry) {
  const response = await fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

async function postDomain(url) {
  const response = await fetch(`${API_BASE}/domains`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// ====== 모니터링 상태 로드 및 실시간 반영 ======
// 시작 시 저장된 monitoring 값을 읽어서 monitoringState 갱신
async function loadMonitoringState() {
  monitoringState = await readStore(MONITORING_KEY, "running");
}

// popup에서 start/pause/stop이 바뀌면 storage change로 감지해서 monitoringState 실시간 갱신
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[MONITORING_KEY]) return;
  monitoringState = changes[MONITORING_KEY].newValue ?? "running";
});

loadMonitoringState();

// ====== content script -> background 이벤트 파이프라인 ======
// content.js에서 kind:"event"로 보내는 메시지를 받음
// - 모니터링이 running이면 서버 분석 요청 후 결과를 events에 저장
// - 서버가 죽었으면 reasons:["api_unavailable"]로 저장
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind !== "event") return false;

  (async () => {
    // running 상태가 아니면 이벤트 무시
    if (monitoringState !== "running") {
      sendResponse({ ok: false, stopped: true });
      return;
    }

    // content.js가 준 url이 없으면 sender.tab.url로 보정
    const url = message.payload.url || sender?.tab?.url || "";

    // 서버로 보낼 payload 구성
    const payload = {
      type: message.payload.type,
      url,
      meta: message.payload.meta ?? null,
    };

    try {
      // 분석 서버에 전송
      const result = await postEvent(payload);
      // 분석 결과(reasons) 포함해 이벤트 저장
      await addEvent({
        ts: new Date().toISOString(),
        type: payload.type,
        url,
        meta: payload.meta ?? null,
        reasons: result.reasons ?? [],
        ok: true,
      });
      sendResponse({ ok: true });
    } catch (error) {
      // 서버가 죽었거나 통신 실패 시 fallback 저장
      await addEvent({
        ts: new Date().toISOString(),
        type: payload.type,
        url,
        meta: payload.meta ?? null,
        reasons: ["api_unavailable"],
        ok: false,
      });
      sendResponse({ ok: false });
    }
  })();

  return true;  // 비동기 sendResponse 사용
});


// ====== 탭 URL 업데이트 감지 -> 도메인 기록 ======
// 페이지 로딩 완료 시 도메인 history에 추가
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) return;
  if (monitoringState !== "running") return;
  addDomain(tab.url);
});


// ====== 다운로드 이벤트 저장(실제 다운로드 완료) ======
// safeHostname: URL에서 hostname 안전 추출
function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return url || ""; }
}

// 파일 경로에서 파일명만 추출
function safeBasename(pathname) {
  if (!pathname) return "";
  const parts = pathname.split(/[\\/]/);
  return parts[parts.length - 1] || "";
}

// URL pathname에서 확장자 추출
function extractExtensionFromUrl(url) {
  try {
    const parsed = new URL(url);
    const name = safeBasename(parsed.pathname || "");
    const ext = name.includes(".") ? name.split(".").pop() : "";
    return (ext || "").toLowerCase();
  } catch {
    return "";
  }
}

// filename에서 확장자 추출
function extractExtensionFromFilename(filename) {
  if (!filename) return "";
  const name = safeBasename(filename);
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return (ext || "").toLowerCase();
}

// pushEvent: storage에 events/domains 동시 저장(다운로드 감지용)
async function pushEvent(ev) {
  const { [EVENTS_KEY]: events = [], [DOMAINS_KEY]: domains = [] } =
    await chrome.storage.local.get([EVENTS_KEY, DOMAINS_KEY]);

  const nextEvents = [ev, ...events].slice(0, MAX_EVENTS);

  const host = safeHostname(ev.url);
  const nextDomains = host
    ? [host, ...domains.filter(d => d !== host)].slice(0, MAX_DOMAINS)
    : domains;

  await chrome.storage.local.set({
    [EVENTS_KEY]: nextEvents,
    [DOMAINS_KEY]: nextDomains,
  });

  try {
    await postStoredEvent(ev);
  } catch {
    // ignore API errors for events
  }
}

// chrome.downloads.onChanged:
// 다운로드 상태가 complete가 되었을 때만 처리
// - 확장자 필터(DOWNLOAD_EXTENSIONS) 통과한 경우에만 download 이벤트 저장
chrome.downloads.onChanged.addListener(async (delta) => {
  if (monitoringState !== "running") return;
  if (!delta.state || delta.state.current !== "complete") return;

  const [item] = await chrome.downloads.search({ id: delta.id });
  if (!item) return;

  // 확장프로그램이 만든 다운로드는 무시(자체 다운로드 이벤트 오염 방지)
  if (item.byExtensionId) return;

  // http/https가 아닌 다운로드는 무시
  const url = item.finalUrl || item.url || "";
  if (!url.startsWith("http")) return;

  // filename과 확장자 추출
  const filename = item.filename ? safeBasename(item.filename) : "";
  const ext = extractExtensionFromFilename(filename) || extractExtensionFromUrl(url);
  
  // 관심 확장자만 감지
  if (!DOWNLOAD_EXTENSIONS.includes(ext)) return;


  // 저장
  await pushEvent({
    type: "download",
    ts: new Date().toISOString(),
    url,
    meta: { filename },
    reasons: ["download_complete"],
  });
});
