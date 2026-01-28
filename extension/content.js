const PII_KEYWORDS = [
  "name",
  "email",
  "phone",
  "tel",
  "address",
  "street",
  "city",
  "zip",
  "postal",
  "birthday",
  "birth",
  "ssn",
  "social",
  "passport",
  "national",
];

const PII_AUTOCOMPLETE = [
  "name",
  "given-name",
  "family-name",
  "email",
  "tel",
  "tel-national",
  "tel-country-code",
  "street-address",
  "address-line1",
  "address-line2",
  "postal-code",
  "country",
  "bday",
  "bday-day",
  "bday-month",
  "bday-year",
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
  "iban",
  "routing",
];

const PAYMENT_AUTOCOMPLETE = [
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-name",
  "cc-given-name",
  "cc-family-name",
];

const PAYMENT_BUTTON_KEYWORDS = [
  "pay",
  "checkout",
  "purchase",
  "buy",
  "order",
  "subscribe",
  "donate",
];

const DOWNLOAD_EXTENSIONS = ["exe", "zip", "dmg", "apk", "msi", "pdf"];
const MONITORING_KEY = "monitoring";
const EVENT_COOLDOWN_MS = 3000;

let monitoringState = "running";
const lastEventAt = new WeakMap();

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function safeText(value, maxLen = 60) {
  const text = (value || "").toString().trim();
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen)}��` : text;
}

function getLabelText(el) {
  if (!el) return "";
  if (el.labels && el.labels.length) {
    return Array.from(el.labels)
      .map((label) => label.textContent || "")
      .join(" ");
  }
  const id = el.getAttribute("id");
  if (!id) return "";
  const escaped = window.CSS && CSS.escape ? CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, "");
  const label = document.querySelector(`label[for="${escaped}"]`);
  return label?.textContent || "";
}

function fieldText(el) {
  const parts = [
    el?.getAttribute("name"),
    el?.getAttribute("id"),
    el?.getAttribute("placeholder"),
    el?.getAttribute("aria-label"),
    getLabelText(el),
  ];
  return normalizeText(parts.filter(Boolean).join(" "));
}

function matchKeywords(text, keywords) {
  return keywords.filter((kw) => text.includes(kw));
}

function uniquePush(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function getAutocomplete(el) {
  return normalizeText(el?.getAttribute("autocomplete"));
}

function shouldSend(el, type) {
  const now = Date.now();
  const lastMap = lastEventAt.get(el) || {};
  if (lastMap[type] && now - lastMap[type] < EVENT_COOLDOWN_MS) {
    return false;
  }
  lastMap[type] = now;
  lastEventAt.set(el, lastMap);
  return true;
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

async function sendEvent(type, meta, sourceEl) {
  if (monitoringState !== "running") return;
  if (sourceEl && !shouldSend(sourceEl, type)) return;

  chrome.runtime.sendMessage({
    kind: "event",
    payload: {
      type,
      url: window.location.href,
      meta,
    },
  });
}

function detectPaymentFromField(el) {
  const text = fieldText(el);
  const autocomplete = getAutocomplete(el);
  const hits = matchKeywords(text, PAYMENT_KEYWORDS);

  if (autocomplete && PAYMENT_AUTOCOMPLETE.some((key) => autocomplete.startsWith(key))) {
    uniquePush(hits, "cc");
    return { fields: hits, trigger: "autocomplete" };
  }

  const inputType = normalizeText(el?.getAttribute("type"));
  if (inputType === "number" || inputType === "tel") {
    const maxLength = Number.parseInt(el?.getAttribute("maxlength") || "", 10);
    if (!Number.isNaN(maxLength) && maxLength >= 12 && maxLength <= 19) {
      uniquePush(hits, "card");
    }
  }

  if (hits.length) {
    return { fields: hits, trigger: "keyword" };
  }

  return null;
}

function detectPiiFromField(el) {
  const text = fieldText(el);
  const autocomplete = getAutocomplete(el);
  const hits = matchKeywords(text, PII_KEYWORDS);

  const inputType = normalizeText(el?.getAttribute("type"));
  if (inputType === "email") uniquePush(hits, "email");
  if (inputType === "tel") uniquePush(hits, "phone");

  if (autocomplete) {
    PII_AUTOCOMPLETE.forEach((key) => {
      if (autocomplete.startsWith(key)) uniquePush(hits, key);
    });
  }

  if (hits.length) {
    return { fields: hits, trigger: "keyword" };
  }

  return null;
}

async function handleInputEvent(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

  const payment = detectPaymentFromField(target);
  if (payment) {
    await sendEvent("payment", payment, target);
    return;
  }

  const pii = detectPiiFromField(target);
  if (pii) {
    await sendEvent("pii_input", pii, target);
  }
}

function isPaymentButton(el) {
  if (!el) return false;
  const text = normalizeText(el.textContent || el.getAttribute("value") || el.getAttribute("aria-label"));
  return PAYMENT_BUTTON_KEYWORDS.some((kw) => text.includes(kw));
}

async function handleClickEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const anchor = target.closest("a");
  if (anchor) {
    const href = anchor.getAttribute("href") || "";
    const downloadAttr = anchor.getAttribute("download");
    if (downloadAttr) {
      await sendEvent("download", { filename: safeText(downloadAttr), trigger: "download_attr" }, anchor);
      return;
    }

    const ext = href.split(".").pop()?.toLowerCase() || "";
    if (DOWNLOAD_EXTENSIONS.includes(ext)) {
      await sendEvent("download", { filename: safeText(href.split("/").pop() || ""), trigger: "file_ext" }, anchor);
      return;
    }
  }

  const button = target.closest("button, input[type=" +
    "submit" +
    "], input[type=" +
    "button" +
    "], input[type=" +
    "image" +
    "], a");
  if (button && isPaymentButton(button)) {
    const text = safeText(button.textContent || button.getAttribute("value") || button.getAttribute("aria-label"));
    await sendEvent("payment", { trigger: "button", buttonText: text }, button);
  }
}

async function handleSubmitEvent(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;

  const fields = Array.from(form.querySelectorAll("input, textarea"));
  const paymentHits = [];

  for (const field of fields) {
    const result = detectPaymentFromField(field);
    if (result?.fields?.length) {
      result.fields.forEach((fieldName) => uniquePush(paymentHits, fieldName));
    }
  }

  if (paymentHits.length) {
    await sendEvent("payment", { fields: paymentHits, trigger: "form_submit" }, form);
  }
}

document.addEventListener("input", handleInputEvent, true);
document.addEventListener("change", handleInputEvent, true);
document.addEventListener("blur", handleInputEvent, true);
document.addEventListener("click", handleClickEvent, true);
document.addEventListener("submit", handleSubmitEvent, true);
