// ===============================
// 개인정보/결제/다운로드 시도 감지 Content Script
// - 페이지에 주입되어 사용자의 입력/클릭/제출 이벤트를 감지
// - 입력 필드의 name/id/placeholder/label/autocomplete 등을 분석해
//   개인정보(PII) 입력 시도, 결제(PAYMENT) 시도, 다운로드(DOWNLOAD) 시도를 추정
// - 추정된 이벤트를 background.js로 메시지 전송(kind:"event")
// ===============================

// ---------- 개인정보(PII) 키워드 목록 ----------
// 입력 필드의 name/id/placeholder/label 등에 아래 단어가 포함되면
// "개인정보 입력" 가능성이 있다고 판단하는 휴리스틱
const PII_KEYWORDS = [
  "name",
  "account",
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
  "이름",
  "성명",
  "성함",
  "아이디",
  "계정",
  "회원번호",
  "이메일",
  "메일",
  "전화",
  "휴대폰",
  "핸드폰",
  "휴대전화",
  "연락처",
  "주소",
  "우편",
  "우편번호",
  "생년월일",
  "생일",
  "주민등록",
  "주민번호",
  "여권",
  "국적",
  "운전면허",
  "사업자",
  "사업자번호",
];

// ---------- 개인정보(PII) autocomplete 표준 값 ----------
// input autocomplete 속성은 브라우저 표준 값이 많아서,
// 이를 통해 "이 필드가 개인정보 입력칸인지" 높은 신뢰도로 추정 가능
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

// ---------- 결제(PAYMENT) 키워드 목록 ----------
// 결제/카드/은행/계좌/송금 관련 입력칸을 추정하기 위한 키워드들
// (주의: 단어가 너무 넓으면 로그인/계정(account) 입력도 결제로 오탐될 수 있음)
const PAYMENT_KEYWORDS = [
  "card",
  "cc",
  "cvv",
  "cvc",
  "expiry",
  "exp",
  "billing",
  "bank",
  "payment",
  "accountnumber",
  "accountno",
  "acct",
  "iban",
  "routing",
  "카드",
  "신용카드",
  "체크카드",
  "카드번호",
  "유효기간",
  "만료",
  "보안코드",
  "결제수단",
  "계좌",
  "계좌번호",
  "은행",
  "송금",
  "입금",
  "출금",
];

// ---------- 결제(PAYMENT) autocomplete 표준 값 ----------
// 브라우저 자동완성 표준으로 카드번호/유효기간/CVV 등 입력칸을 강하게 식별 가능
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

// ---------- 결제 버튼 텍스트 키워드 ----------
// 클릭한 버튼의 텍스트(혹은 value/aria-label)에 아래 키워드가 포함되면
// 결제/구매 행위로 추정하여 payment 이벤트를 발생시킴
const PAYMENT_BUTTON_KEYWORDS = [
  "pay",
  "checkout",
  "purchase",
  "buy",
  "order",
  "subscribe",
  "donate",
  "결제",
  "결재",
  "구매",
  "주문",
  "구독",
  "후원",
  "기부",
];

// ---------- 다운로드 확장자 필터 ----------
// 클릭한 링크의 확장자가 아래 목록에 포함되면 "다운로드 시도"로 추정
const DOWNLOAD_EXTENSIONS = ["exe", "zip", "dmg", "apk", "msi", "pdf"];

// ---------- 모니터링 상태 키 ----------
// popup.js에서 start/pause/stop 버튼으로 변경되는 상태를 storage에서 읽어옴
const MONITORING_KEY = "monitoring";

// ---------- 이벤트 중복 전송 방지(쿨다운) ----------
// 같은 요소에서 같은 type 이벤트를 너무 자주 보내지 않도록 막는 시간(밀리초)
const EVENT_COOLDOWN_MS = 3000;

// ---------- 현재 모니터링 상태 ----------
// running이 아니면 이벤트를 전송하지 않음
let monitoringState = "running";

// ---------- 요소별 마지막 이벤트 전송 시간 기록 ----------
// WeakMap을 써서 DOM 요소가 사라질 때 메모리 누수 없이 자동 해제되도록 함
const lastEventAt = new WeakMap();

// ---------- 문자열 정규화 ----------
// null/undefined 방지 + trim + 소문자 처리
function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

// ---------- 텍스트 안전 출력 ----------
// 너무 긴 텍스트(버튼 텍스트 등)는 UI/로그를 위해 잘라냄
function safeText(value, maxLen = 60) {
  const text = (value || "").toString().trim();
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen)}��` : text;
}

// ---------- input에 연결된 label 텍스트 추출 ----------
// 1) el.labels (브라우저가 연결해주는 label 리스트)가 있으면 그 텍스트 사용
// 2) 없으면 id 기반으로 label[for="id"]를 찾아 텍스트 사용
// label은 "아이디", "비밀번호", "카드번호" 같은 중요한 단서를 제공함
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

// ---------- 필드의 의미를 추정하기 위한 텍스트 생성 ----------
// input/textarea의 name/id/placeholder/aria-label/label을 합쳐서 하나의 텍스트로 만들고,
// 키워드 매칭(PII/PAYMENT)을 수행함
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

// ---------- 키워드 매칭 ----------
// text 안에 포함된 keyword만 필터링하여 반환
// 예: text="user email address" => ["email", "address"]
function matchKeywords(text, keywords) {
  return keywords.filter((kw) => text.includes(kw));
}

// ---------- 중복 없는 push ----------
// list에 value가 없을 때만 추가
function uniquePush(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

// ---------- autocomplete 속성 추출 ----------
// autocomplete 값은 표준화되어 있어 분류 신뢰도를 높임
function getAutocomplete(el) {
  return normalizeText(el?.getAttribute("autocomplete"));
}

// ---------- 이벤트 중복 전송 제한 ----------
// 같은 요소(sourceEl)에서 같은 type 이벤트가 EVENT_COOLDOWN_MS 내에 반복되면 전송하지 않음
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

// ---------- storage에서 모니터링 상태 로드 ----------
// 확장 시작 시 이전 상태(running/paused/stopped)를 복원
async function loadMonitoringState() {
  const result = await chrome.storage.local.get(MONITORING_KEY);
  monitoringState = result[MONITORING_KEY] ?? "running";
}

// ---------- popup에서 상태 변경 시 즉시 반영 ----------
// storage가 바뀌면 monitoringState를 갱신하여 감지 로직에 적용
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[MONITORING_KEY]) return;
  monitoringState = changes[MONITORING_KEY].newValue ?? "running";
});

loadMonitoringState();

// ---------- 이벤트를 background로 전송 ----------
// - monitoringState가 running일 때만 전송
// - sourceEl이 있으면 shouldSend로 같은 요소의 중복 이벤트를 제한
// - background.js는 kind:"event" 메시지를 받아 서버 분석 후 events 저장
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

// ---------- 결제 입력 필드 감지 ----------
// 입력 필드가 결제 관련인지 추정하여 meta(fields, trigger)를 반환
// 반환값이 null이면 결제 입력으로 보지 않음
function detectPaymentFromField(el) {
  const text = fieldText(el);
  const autocomplete = getAutocomplete(el);
  const hits = matchKeywords(text, PAYMENT_KEYWORDS);

  // (1) autocomplete이 cc-* 계열이면 결제 입력으로 강하게 확정
  if (autocomplete && PAYMENT_AUTOCOMPLETE.some((key) => autocomplete.startsWith(key))) {
    uniquePush(hits, "cc");
    return { fields: hits, trigger: "autocomplete" };
  }

  // (2) type이 number/tel인데 maxlength가 12~19면 카드번호 가능성이 있어 힌트 추가
  const inputType = normalizeText(el?.getAttribute("type"));
  if (inputType === "number" || inputType === "tel") {
    const maxLength = Number.parseInt(el?.getAttribute("maxlength") || "", 10);
    if (!Number.isNaN(maxLength) && maxLength >= 12 && maxLength <= 19) {
      uniquePush(hits, "card");
    }
  }

  // (3) 키워드 히트가 하나라도 있으면 결제로 분류
  if (hits.length) {
    return { fields: hits, trigger: "keyword" };
  }

  return null;
}

// ---------- 개인정보 입력 필드 감지 ----------
// 입력 필드가 개인정보 관련인지 추정하여 meta(fields, trigger)를 반환
function detectPiiFromField(el) {
  const text = fieldText(el);
  const autocomplete = getAutocomplete(el);
  const hits = matchKeywords(text, PII_KEYWORDS);

  // (1) input type 자체가 email/tel이면 개인정보 가능성 힌트 추가
  const inputType = normalizeText(el?.getAttribute("type"));
  if (inputType === "email") uniquePush(hits, "email");
  if (inputType === "tel") uniquePush(hits, "phone");

  // (2) autocomplete 표준 값이 있으면 힌트 추가
  if (autocomplete) {
    PII_AUTOCOMPLETE.forEach((key) => {
      if (autocomplete.startsWith(key)) uniquePush(hits, key);
    });
  }

  // (3) 키워드 히트가 하나라도 있으면 개인정보로 분류
  if (hits.length) {
    return { fields: hits, trigger: "keyword" };
  }

  return null;
}

// ---------- 입력 이벤트 핸들러 ----------
// input/change/blur 이벤트에서 호출됨
// - 현재 로직은 "결제(payment) 감지 -> 있으면 payment 전송 후 return" 우선순위
// - 결제 오탐이 발생하면 pii_input이 실행되지 않아서 로그인도 결제로 뜰 수 있음
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

// ---------- 결제 버튼인지 판정 ----------
// 버튼 텍스트/value/aria-label에 결제/구매/주문 키워드가 포함되면 true
function isPaymentButton(el) {
  if (!el) return false;
  const text = normalizeText(el.textContent || el.getAttribute("value") || el.getAttribute("aria-label"));
  return PAYMENT_BUTTON_KEYWORDS.some((kw) => text.includes(kw));
}

// ---------- 클릭 이벤트 핸들러 ----------
// - 다운로드 링크(a 태그) 클릭 감지
// - 결제 버튼 클릭 감지
async function handleClickEvent(event) {
  if (!event.isTrusted) return;
  if (event instanceof MouseEvent && event.button !== 0) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  // (1) a 태그(링크)에서 다운로드 시도 추정
  const anchor = target.closest("a");
  if (anchor) {
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    // download 속성이 있으면 "다운로드 시도"로 판단 (filename은 download 속성값)
    if (anchor.hasAttribute("download")) {
      const downloadAttr = anchor.getAttribute("download") || "";
      await sendEvent("download", { filename: safeText(downloadAttr), trigger: "download_attr" }, anchor);
      return;
    }

    // href의 확장자를 보고 관심 확장자면 다운로드로 판단
    let ext = "";
    try {
      const url = new URL(href, window.location.href);
      const pathname = url.pathname || "";
      ext = pathname.split(".").pop()?.toLowerCase() || "";
    } catch {
      ext = "";
    }
    if (DOWNLOAD_EXTENSIONS.includes(ext)) {
      const filename = safeText(href.split("/").pop() || "");
      await sendEvent("download", { filename, trigger: "file_ext" }, anchor);
      return;
    }
  }

  // (2) 결제 버튼 클릭 감지
  // 버튼 후보: button, input[type=submit|button|image], a(링크 버튼)
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

// ---------- submit 이벤트 핸들러 ----------
// form 제출 시 폼 안의 input/textarea를 훑어서 결제 필드가 있는지 검사
// 결제 관련 필드가 하나라도 감지되면 payment 이벤트 전송
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

// ---------- 이벤트 리스너 등록(캡처링 단계에서 감지) ----------
// true로 등록해서 페이지의 다른 핸들러보다 먼저 캐치할 수 있음
document.addEventListener("input", handleInputEvent, true);
document.addEventListener("change", handleInputEvent, true);
document.addEventListener("blur", handleInputEvent, true);
document.addEventListener("click", handleClickEvent, true);
document.addEventListener("submit", handleSubmitEvent, true);
