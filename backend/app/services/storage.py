from collections import Counter
from typing import Any, Dict, List
from urllib.parse import urlparse

from ..core.time import utc_now_iso

MAX_EVENTS_STORE = 500
MAX_DOMAINS_STORE = 200
EVENTS_STORE: List[Dict[str, Any]] = []
DOMAINS_STORE: List[Dict[str, Any]] = []


def _domain_from_url(url: str) -> str:
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def push_event(item: Dict[str, Any]) -> None:
    EVENTS_STORE.insert(0, item)
    if len(EVENTS_STORE) > MAX_EVENTS_STORE:
        del EVENTS_STORE[MAX_EVENTS_STORE:]


def push_domain(url: str) -> None:
    domain = _domain_from_url(url)
    if not domain:
        return
    now_iso = utc_now_iso()
    existing = [d for d in DOMAINS_STORE if d.get("domain") != domain]
    DOMAINS_STORE.clear()
    DOMAINS_STORE.append({"domain": domain, "ts": now_iso})
    DOMAINS_STORE.extend(existing)
    if len(DOMAINS_STORE) > MAX_DOMAINS_STORE:
        del DOMAINS_STORE[MAX_DOMAINS_STORE:]


def get_events(limit: int) -> List[Dict[str, Any]]:
    limit = max(0, min(limit, MAX_EVENTS_STORE))
    return EVENTS_STORE[:limit]


def get_domains(limit: int) -> List[Dict[str, Any]]:
    limit = max(0, min(limit, MAX_DOMAINS_STORE))
    return DOMAINS_STORE[:limit]


def build_summary(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    reason_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()
    for ev in events:
        ev_type = ev.get("type")
        if ev_type:
            type_counts[ev_type] += 1
        reasons = ev.get("reasons") or []
        reason_counts.update(reasons)
    return {
        "total_events": len(events),
        "event_types": dict(type_counts),
        "reasons": dict(reason_counts),
        "events": events,
    }
