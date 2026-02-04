// ===============================
// Popup UI Script (popup.js)
// - chrome.storage.local에 저장된 events/domains/monitoring 상태를 읽어 UI에 렌더링
// - Start/Pause/Stop/Reset/Refresh 버튼 동작 처리
// - 이벤트는 <details>/<summary> 형태로: 요약(라벨+시간) 표시 후 클릭 시 도메인/세부 정보 펼침
// - event.meta.fields(감지된 필드 키워드)를 사람이 이해할 수 있는 라벨(아이디/비밀번호/카드번호 등)로 변환해 표시
// ===============================


// ---------- storage 키 정의 ----------
// events: 최근 감지된 이벤트 목록
// domains: 최근 방문 도메인 목록
// monitoring: 모니터링 상태(running/paused/stopped)
const EVENTS_KEY = "events";
const DOMAINS_KEY = "domains";
const MONITORING_KEY = "monitoring";


// ---------- storage 읽기 헬퍼 ----------
// chrome.storage.local.get(key) 결과에서 key가 없으면 fallback 반환
async function readStore(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback;
}


// ---------- storage 쓰기 헬퍼 ----------
// chrome.storage.local.set으로 단일 key/value 저장
async function writeStore(key, value) {
  await chrome.storage.local.set({ [key]: value });
}


// ---------- storage 초기화 ----------
// events/domains 기록을 삭제하여 초기 상태로 리셋
async function clearStore() {
  await chrome.storage.local.remove([EVENTS_KEY, DOMAINS_KEY]);
}


// ---------- 리스트 렌더링 ----------
// element(예: <ul id="events">) 내부를 items로 채움
// - items가 string이면 텍스트 <li> 생성
// - items가 DOM Node면 그대로 <li>에 append
// - items가 비었으면 emptyText를 muted 스타일로 표시
function renderList(element, items, emptyText) {
  element.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "list-item muted";
    li.textContent = emptyText;
    element.appendChild(li);
    return;
  }

  for (const item of items) {
    if (typeof item === "string") {
      const li = document.createElement("li");
      li.className = "list-item";
      li.textContent = item;
      element.appendChild(li);
      continue;
    }

    if (item instanceof Node) {
      const li = document.createElement("li");
      li.className = "event-container";
      li.appendChild(item);
      element.appendChild(li);
    }
  }
}


// ---------- 상태 표시/버튼 활성화 제어 ----------
// monitoring 상태에 따라:
// - Status 텍스트 변경
// - Start/Pause/Stop 버튼 disabled 상태 변경
function updateStatus(state) {
  const status = document.getElementById("status");
  const startButton = document.getElementById("start");
  const pauseButton = document.getElementById("pause");
  const stopButton = document.getElementById("stop");
  if (!status || !startButton || !pauseButton || !stopButton) return;

  if (state === "stopped") {
    status.textContent = "Status: Stopped";
    startButton.disabled = false;
    pauseButton.disabled = true;
    stopButton.disabled = true;
    return;
  }

  if (state === "paused") {
    status.textContent = "Status: Paused";
    startButton.disabled = false;
    pauseButton.disabled = true;
    stopButton.disabled = false;
    return;
  }

  status.textContent = "Status: Running";
  startButton.disabled = true;
  pauseButton.disabled = false;
  stopButton.disabled = false;
}


// ---------- 이벤트 타입 -> 사용자 표시 라벨 ----------
// event.type 값에 따라 popup 요약 라벨을 결정
// (pii_input: 개인정보 입력 시도 / download: 파일 다운로드 시도 / payment: 결제 시도)
function typeLabel(type) {
  if (type === "pii_input") return "개인정보 입력 시도";
  if (type === "download") return "파일 다운로드 시도";
  if (type === "payment") return "결제 시도";
  return "이상 행위 감지";
}


// ---------- ISO 시간 -> 상대 시간 문자열 ----------
// event.ts(ISO string)를 "방금 / N분 전 / N시간 전 / N일 전" 형태로 변환
function formatTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}일 전`;
}


// ---------- URL에서 도메인(hostname) 안전 추출 ----------
// URL 파싱 실패 시 원본 문자열(또는 "") 반환
function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "";
  }
}


// ---------- 이벤트 하나를 UI 컴포넌트(<details>)로 생성 ----------
// - summary: "개인정보 입력 시도 · 5분 전" 같은 한 줄 요약
// - 펼치면:
//   * 도메인 표시
//   * pii_input이면 어떤 항목(아이디/비번/전화 등)이 감지됐는지 표시
//   * download이면 파일명 표시
function buildEventItem(event) {
  const details = document.createElement("details");
  details.className = "event-item";

  const summary = document.createElement("summary");
  const timeText = event.ts ? formatTime(event.ts) : "";
  summary.textContent = timeText ? `${typeLabel(event.type)} · ${timeText}` : typeLabel(event.type);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.className = "event-details";

  // (1) 도메인 표시
  const domainLine = document.createElement("div");
  domainLine.className = "event-domain";
  domainLine.textContent = `도메인: ${safeHostname(event.url)}`;
  content.appendChild(domainLine);

  // (2) 개인정보 입력 이벤트라면: event.meta.fields 기반으로 "어떤 정보"를 추정해 표시
  if (event.type === "pii_input") {
    const kinds = inferPiiKinds(event);

    const piiLine = document.createElement("div");
    piiLine.className = "event-meta";

    // meta.fields 매핑이 되면 "아이디, 비밀번호"처럼 보여주고
    // 매핑이 실패하면 fallback 문구를 보여줌
    piiLine.textContent = kinds.length
      ? `입력 감지: ${kinds.join(", ")}`
      : "입력 감지: 개인정보(세부 항목 식별 불가)";
    content.appendChild(piiLine);
  }

  // (3) 다운로드 이벤트라면: 파일명(meta.filename)을 표시
  if (event.type === "download" && event.meta?.filename) {
    const fileLine = document.createElement("div");
    fileLine.className = "event-meta";
    fileLine.textContent = `파일: ${event.meta.filename}`;
    content.appendChild(fileLine);
  }

  details.appendChild(content);
  return details;
}


// ---------- 화면 갱신 ----------
// storage에서 events/domains/monitoring을 읽어서 UI를 다시 렌더링
// - events는 ts 기준으로 내림차순 정렬하여 최신이 위로 오게 함
async function refresh() {
  const eventsEl = document.getElementById("events");
  const domainsEl = document.getElementById("domains");
  if (!eventsEl || !domainsEl) return;

  const events = await readStore(EVENTS_KEY, []);
  const domains = await readStore(DOMAINS_KEY, []);
  const state = await readStore(MONITORING_KEY, "running");

  // 최신 이벤트가 위에 오도록 정렬
  const ordered = [...events].sort((a, b) => {
    const ta = a?.ts ? Date.parse(a.ts) : 0;
    const tb = b?.ts ? Date.parse(b.ts) : 0;
    return tb - ta; // 최신 먼저
  });

  const eventItems = ordered.map(buildEventItem);

  renderList(eventsEl, eventItems, "아직 감지된 이벤트가 없습니다.");
  renderList(domainsEl, domains, "아직 기록된 도메인이 없습니다.");
  updateStatus(state);
}


// ---------- 버튼 이벤트 바인딩 ----------
// Refresh: UI 재렌더
document.getElementById("refresh")?.addEventListener("click", refresh);

// Start: monitoringState를 running으로 저장 후 UI 갱신
document.getElementById("start")?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "running");
  refresh();
});

// Pause: monitoringState를 paused로 저장 후 UI 갱신
document.getElementById("pause")?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "paused");
  refresh();
});

// Stop: monitoringState를 stopped로 저장 + stop.html 팝업 띄움 + UI 갱신
document.getElementById("stop")?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "stopped");
  chrome.windows.create({
    url: "stop.html",
    type: "popup",
    width: 360,
    height: 220,
  });
  refresh();
});

// Reset: 확인창 후 events/domains 삭제 + UI 갱신
document.getElementById("reset")?.addEventListener("click", async () => {
  const ok = window.confirm("저장된 이벤트/도메인 기록을 모두 초기화할까요?");
  if (!ok) return;
  await clearStore();
  refresh();
});

// popup 열릴 때 최초 렌더
refresh();


// ---------- meta.fields 키워드 정규화 ----------
// 공백/하이픈/언더스코어 제거 + 소문자화
// content.js에서 meta.fields로 들어온 키워드를 정규화해 매칭 정확도를 높임
function normalizeKey(s) {
  return String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
}


// ---------- meta.fields 단어 -> 사람이 이해하는 라벨로 변환 ----------
// event.meta.fields에 들어오는 값은 content.js의 keyword hit(ex: "email", "card", "주민번호")이므로,
// 이를 "이메일", "카드번호" 같은 사용자 친화 라벨로 매핑
function piiFieldLabel(raw) {
  const k = normalizeKey(raw);

  // 아이디/계정
  if (/(userid|username|loginid|account|memberid|id|아이디|계정|회원아이디|로그인아이디)/.test(k)) return "아이디";
  if (/(email|e?mailaddress|이메일|메일)/.test(k)) return "이메일";

  // 비밀번호
  if (/(password|passwd|pwd|passcode|pin|비밀번호|비번|패스워드|암호)/.test(k)) return "비밀번호";

  // 개인정보
  if (/(ssn|social|주민등록|주민번호)/.test(k)) return "주민등록번호";
  if (/(passport|여권)/.test(k)) return "여권번호";
  if (/(driver|license|운전면허)/.test(k)) return "운전면허번호";
  if (/(business|company|사업자등록|사업자번호|사업자)/.test(k)) return "사업자번호";
  if (/(name|fullname|firstname|lastname|이름|성명|성함|실명)/.test(k)) return "이름";
  if (/(phone|tel|mobile|cell|hp|전화|휴대폰|핸드폰|휴대전화|연락처|모바일)/.test(k)) return "전화번호";
  if (/(birth|birthday|dob|생년월일|생일|출생)/.test(k)) return "생년월일";
  if (/(address|addr|zipcode|postal|주소|우편번호|우편|배송지)/.test(k)) return "주소";

  // 결제정보
  if (/(cardnumber|ccnumber|creditcard|cardno|pan|카드번호|신용카드|체크카드|카드)/.test(k)) return "카드번호";
  if (/(cvc|cvv|securitycode|보안코드)/.test(k)) return "CVC/CVV";
  if (/(exp|expiry|expiration|유효기간|만료)/.test(k)) return "유효기간";

  // 기타
  return null;
}

// ---------- meta.valueKinds -> label ----------
// valueKinds? ??? ??? ???? ? ??(?? ?? ???? ??)
function piiValueKindLabel(raw) {
  return piiFieldLabel(raw);
}


// ---------- event.meta.fields -> 라벨 배열로 추정 ----------
// content.js가 meta.fields에 담아준 키워드 배열을 받아
// piiFieldLabel로 변환 -> 중복 제거 -> ["아이디","비밀번호"] 형태로 반환
function inferPiiKinds(event) {
  const valueKinds = Array.isArray(event?.meta?.valueKinds) ? event.meta.valueKinds : [];
  if (valueKinds.length) {
    const valueLabels = valueKinds.map(piiValueKindLabel).filter(Boolean);
    if (valueLabels.length) return [...new Set(valueLabels)];
  }


  const fields = Array.isArray(event?.meta?.fields) ? event.meta.fields : [];
  const labels = [];

  for (const f of fields) {
    const label = piiFieldLabel(f);
    if (label) labels.push(label);
  }

  // 중복 제거
  return [...new Set(labels)];
}
