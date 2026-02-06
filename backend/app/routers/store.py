from fastapi import APIRouter

from ..models import DomainIn, StoredEvent
from ..core.time import to_utc_iso, utc_now_iso
from ..services.ai_client import fetch_ai_analysis
from ..services.storage import build_summary, get_domains, get_events, push_domain, push_event

router = APIRouter()


@router.post("/events")
async def store_event(ev: StoredEvent):
    item = {
        "ts": to_utc_iso(ev.ts),
        "type": ev.type,
        "url": str(ev.url),
        "meta": ev.meta,
        "reasons": ev.reasons or [],
        "ok": ev.ok,
    }
    push_event(item)
    return {"ok": True}


@router.get("/events")
async def list_events(limit: int = 100):
    return {"events": get_events(limit)}


@router.post("/domains")
async def store_domain(payload: DomainIn):
    push_domain(str(payload.url))
    try:
        analysis = await fetch_ai_analysis(str(payload.url))
    except Exception:
        analysis = None

    if analysis and analysis.get("status") in {"DANGER", "CAUTION"}:
        push_event(
            {
                "ts": utc_now_iso(),
                "type": "phishing",
                "url": str(payload.url),
                "meta": {
                    "ai_status": analysis.get("status"),
                    "detection_source": analysis.get("detection_source"),
                },
                "reasons": analysis.get("reports") or [],
                "ok": True,
            }
        )
    return {"ok": True}


@router.get("/domains")
async def list_domains(limit: int = 50):
    return {"domains": get_domains(limit)}


@router.get("/summary")
async def get_summary():
    return {"summary": build_summary(get_events(500))}
