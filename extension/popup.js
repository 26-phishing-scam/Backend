const EVENTS_KEY = "events"; // 최근 이벤트 목록 저장 키
const DOMAINS_KEY = "domains"; // 최근 도메인 목록 저장 키
const MONITORING_KEY = "monitoring"; // 모니터링 상태 저장 키

async function readStore(key, fallback) {
  const result = await chrome.storage.local.get(key); // 확장 프로그램 로컬 스토리지에서 읽기
  return result[key] ?? fallback; // 없으면 기본값 사용
}

async function writeStore(key, value) {
  await chrome.storage.local.set({ [key]: value }); // 확장 프로그램 로컬 스토리지에 저장
}

async function clearStore() {
  await chrome.storage.local.remove([EVENTS_KEY, DOMAINS_KEY]); // 이벤트/도메인 기록 초기화
}

function renderList(element, items, emptyText) {
  element.innerHTML = ""; // 리스트 초기화
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = emptyText; // 비어있을 때 안내 문구
    element.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item; // 각 항목 렌더링
    element.appendChild(li);
  }
}

function updateStatus(state) {
  const status = document.getElementById("status");
  const startButton = document.getElementById("start");
  const pauseButton = document.getElementById("pause");
  const stopButton = document.getElementById("stop");
  if (!status || !startButton || !pauseButton || !stopButton) return;

  if (state === "stopped") {
    status.textContent = "상태: 종료됨";
    startButton.disabled = false; // 다시 시작 가능
    pauseButton.disabled = true; // 종료 상태에서는 일시정지 불가
    stopButton.disabled = true; // 이미 종료됨
    return;
  }

  if (state === "paused") {
    status.textContent = "상태: 일시정지";
    startButton.disabled = false; // 재개 가능
    pauseButton.disabled = true; // 이미 일시정지됨
    stopButton.disabled = false; // 일시정지 상태에서도 종료 가능
    return;
  }

  status.textContent = "상태: 실행 중";
  startButton.disabled = true; // 실행 중이면 시작 비활성화
  pauseButton.disabled = false;
  stopButton.disabled = false;
}

async function refresh() {
  const eventsEl = document.getElementById("events");
  const domainsEl = document.getElementById("domains");
  if (!eventsEl || !domainsEl) return;

  const events = await readStore(EVENTS_KEY, []); // 최근 이벤트 불러오기
  const domains = await readStore(DOMAINS_KEY, []); // 최근 도메인 불러오기
  const state = await readStore(MONITORING_KEY, "running"); // 모니터링 상태 불러오기

  const eventLines = events.map((event) => {
    const reasonText = (event.reasons || []).join(", ") || "정상"; // 사유 목록 합치기
    return `[${event.type}] ${new URL(event.url).hostname} - ${reasonText}`; // 표시 문자열
  });

  renderList(eventsEl, eventLines, "아직 이벤트가 없습니다.");
  renderList(domainsEl, domains, "아직 도메인 기록이 없습니다.");
  updateStatus(state);
}

// UI 이벤트 바인딩
const refreshButton = document.getElementById("refresh");
refreshButton?.addEventListener("click", refresh);

const startButton = document.getElementById("start");
startButton?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "running"); // 실행 상태로 표시
  refresh();
});

const pauseButton = document.getElementById("pause");
pauseButton?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "paused"); // 일시정지 상태로 표시
  refresh();
});

const stopButton = document.getElementById("stop");
stopButton?.addEventListener("click", async () => {
  await writeStore(MONITORING_KEY, "stopped"); // 종료 상태로 표시
  chrome.windows.create({
    url: "stop.html",
    type: "popup",
    width: 360,
    height: 220,
  }); // 종료 안내 창 띄우기
  refresh();
});

const resetButton = document.getElementById("reset");
resetButton?.addEventListener("click", async () => {
  const ok = window.confirm("저장된 이벤트와 도메인 기록을 모두 초기화할까요?"); // 초기화 확인
  if (!ok) return;
  await clearStore();
  refresh();
});

refresh(); // 최초 렌더링
