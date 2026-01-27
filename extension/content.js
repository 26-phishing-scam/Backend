const PII_KEYWORDS = [
  "name",
  "email",
  "phone",
  "tel",
  "address",
  "birthday",
  "birth",
  "ssn",
  "social",
  "id",
];

const PAYMENT_KEYWORDS = [
  "card",
  "cc",
  "cvv",
  "cvc",
  "expiry",
  "exp",
  "billing",
  "bank",
  "account",
  "payment",
];

const DOWNLOAD_EXTENSIONS = ["exe", "zip", "dmg", "apk", "msi", "pdf"];
const MONITORING_KEY = "monitoring";

let monitoringState = "running";

function textOf(el) {
  return (el?.getAttribute("name") || "")
    .concat(" ", el?.getAttribute("id") || "")
    .concat(" ", el?.getAttribute("placeholder") || "")
    .concat(" ", el?.getAttribute("aria-label") || "")
    .toLowerCase();
}

function matchKeywords(text, keywords) {
  return keywords.filter((kw) => text.includes(kw));
}

async function loadMonitoringState() {
  const result = await chrome.storage.local.get(MONITORING_KEY);
  monitoringState = result[MONITORING_KEY] ?? "running";
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[MONITORING_KEY]) return;
  monitoringState = changes[MONITORING_KEY].newValue ?? "running";
});

loadMonitoringState();

async function sendEvent(type, meta) {
  if (monitoringState !== "running") return;

  chrome.runtime.sendMessage({
    kind: "event",
    payload: {
      type,
      url: window.location.href,
      meta,
    },
  });
}

async function handleInputEvent(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  const text = textOf(target);

  const piiHits = matchKeywords(text, PII_KEYWORDS);
  if (piiHits.length) {
    await sendEvent("pii_input", { fields: piiHits });
    return;
  }

  const paymentHits = matchKeywords(text, PAYMENT_KEYWORDS);
  if (paymentHits.length) {
    await sendEvent("payment", { fields: paymentHits });
  }
}

async function handleClickEvent(event) {
  const target = event.target;
  const anchor = target instanceof Element ? target.closest("a") : null;
  if (!anchor) return;

  const href = anchor.getAttribute("href") || "";
  const downloadAttr = anchor.getAttribute("download");
  if (downloadAttr) {
    await sendEvent("download", { filename: downloadAttr });
    return;
  }

  const ext = href.split(".").pop()?.toLowerCase() || "";
  if (DOWNLOAD_EXTENSIONS.includes(ext)) {
    await sendEvent("download", { filename: href.split("/").pop() || "" });
  }
}

document.addEventListener("change", handleInputEvent, true);
document.addEventListener("blur", handleInputEvent, true);
document.addEventListener("click", handleClickEvent, true);
