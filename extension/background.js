const API_BASE = "http://localhost:8000";
const EVENTS_KEY = "events";
const DOMAINS_KEY = "domains";
const MONITORING_KEY = "monitoring";
const MAX_EVENTS = 100;
const MAX_DOMAINS = 50;

let monitoringState = "running";

async function readStore(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback;
}

async function writeStore(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

function toDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function addDomain(url) {
  const domain = toDomain(url);
  if (!domain) return;
  const domains = await readStore(DOMAINS_KEY, []);
  const next = [domain, ...domains.filter((d) => d !== domain)].slice(0, MAX_DOMAINS);
  await writeStore(DOMAINS_KEY, next);
}

async function addEvent(entry) {
  const events = await readStore(EVENTS_KEY, []);
  const next = [entry, ...events].slice(0, MAX_EVENTS);
  await writeStore(EVENTS_KEY, next);
}

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

async function loadMonitoringState() {
  monitoringState = await readStore(MONITORING_KEY, "running");
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[MONITORING_KEY]) return;
  monitoringState = changes[MONITORING_KEY].newValue ?? "running";
});

loadMonitoringState();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind !== "event") return false;

  (async () => {
    if (monitoringState !== "running") {
      sendResponse({ ok: false, stopped: true });
      return;
    }

    const url = message.payload.url || sender?.tab?.url || "";
    const payload = {
      type: message.payload.type,
      url,
      meta: message.payload.meta ?? null,
    };

    try {
      const result = await postEvent(payload);
      await addEvent({
        ts: new Date().toISOString(),
        type: payload.type,
        url,
        reasons: result.reasons ?? [],
        ok: true,
      });
      sendResponse({ ok: true });
    } catch (error) {
      await addEvent({
        ts: new Date().toISOString(),
        type: payload.type,
        url,
        reasons: ["api_unavailable"],
        ok: false,
      });
      sendResponse({ ok: false });
    }
  })();

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) return;
  if (monitoringState !== "running") return;
  addDomain(tab.url);
});

function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return url || ""; }
}

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
}

chrome.downloads.onCreated.addListener(async (item) => {
  const url = item.finalUrl || item.url || "";
  const filename = item.filename ? item.filename.split(/[\\/]/).pop() : "";

  await pushEvent({
    type: "download",
    ts: new Date().toISOString(),
    url,
    meta: { filename },
    reasons: ["download_started"],
  });
});