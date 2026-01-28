const EVENTS_KEY = "events";
const DOMAINS_KEY = "domains";
const MONITORING_KEY = "monitoring";

async function readStore(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback;
}

async function writeStore(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function clearStore() {
  await chrome.storage.local.remove([EVENTS_KEY, DOMAINS_KEY]);
}

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

// ✅ 한국어 라벨로 변경 (요청: “개인정보 입력 시도 / 파일 다운로드 시도”)
function typeLabel(type) {
  if (type === "pii_input") return "개인정보 입력 시도";
  if (type === "download") return "파일 다운로드 시도";
  if (type === "payment") return "결제 시도";
  return "이상 행위 감지";
}

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

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "";
  }
}

// ✅ 리스트엔 “시도 라벨”만 보이고, 눌렀을 때(펼치면) 도메인이 아래에 보이도록 구성
function buildEventItem(event) {
  const details = document.createElement("details");
  details.className = "event-item";

  const summary = document.createElement("summary");
  const timeText = event.ts ? formatTime(event.ts) : "";
  summary.textContent = timeText ? `${typeLabel(event.type)} · ${timeText}` : typeLabel(event.type);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.className = "event-details";

  const domainLine = document.createElement("div");
  domainLine.className = "event-domain";
  domainLine.textContent = `도메인: ${safeHostname(event.url)}`;
  content.appendChild(domainLine);

  // ✅ 개인정보 입력 이벤트라면 “어떤 정보”인지 표시
  if (event.type === "pii_input") {
    const kinds = inferPiiKinds(event);

    const piiLine = document.createElement("div");
    piiLine.className = "event-meta";

    // meta.fields가 없거나 매핑이 안되면 fallback
    piiLine.textContent = kinds.length
      ? `입력 감지: ${kinds.join(", ")}`
      : "입력 감지: 개인정보(세부 항목 식별 불가)";
    content.appendChild(piiLine);
  }

  // ✅ 다운로드 이벤트라면 파일명
  if (event.type === "download" && event.meta?.filename) {
    const fileLine = document.createElement("div");
    fileLine.className = "event-meta";
    fileLine.textContent = `파일: ${event.meta.filename}`;
    content.appendChild(fileLine);
  }

  details.appendChild(content);
  return details;
}


async function refresh() {
  const eventsEl = document.getElementById("events");
  const domainsEl = document.getElementById("domains");
  if (!eventsEl || !domainsEl) return;

  const events = await readStore(EVENTS_KEY, []);
  const domains = await readStore(DOMAINS_KEY, []);
  const state = await readStore(MONITORING_KEY, "running");

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

document.getElementById("refresh")?.addEventListener("click", refresh);
document.getElementById("start")?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "running");
  refresh();
});
document.getElementById("pause")?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "paused");
  refresh();
});
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
document.getElementById("reset")?.addEventListener("click", async () => {
  const ok = window.confirm("저장된 이벤트/도메인 기록을 모두 초기화할까요?");
  if (!ok) return;
  await clearStore();
  refresh();
});

refresh();

function normalizeKey(s) {
  return String(s || "").toLowerCase().replace(/[\s\-_]/g, "");
}

function piiFieldLabel(raw) {
  const k = normalizeKey(raw);

  // 아이디/계정
  if (/(userid|username|loginid|account|memberid|id)/.test(k)) return "아이디";
  if (/(email|e?mailaddress)/.test(k)) return "이메일";

  // 비밀번호
  if (/(password|passwd|pwd|passcode|pin)/.test(k)) return "비밀번호";

  // 개인정보
  if (/(name|fullname|firstname|lastname)/.test(k)) return "이름";
  if (/(phone|tel|mobile|cell|hp)/.test(k)) return "전화번호";
  if (/(birth|birthday|dob)/.test(k)) return "생년월일";
  if (/(address|addr|zipcode|postal)/.test(k)) return "주소";

  // 결제정보
  if (/(cardnumber|ccnumber|creditcard|cardno|pan)/.test(k)) return "카드번호";
  if (/(cvc|cvv|securitycode)/.test(k)) return "CVC/CVV";
  if (/(exp|expiry|expiration)/.test(k)) return "유효기간";

  // 기타
  return null;
}

function inferPiiKinds(event) {
  const fields = Array.isArray(event?.meta?.fields) ? event.meta.fields : [];
  const labels = [];

  for (const f of fields) {
    const label = piiFieldLabel(f);
    if (label) labels.push(label);
  }

  // 중복 제거
  return [...new Set(labels)];
}