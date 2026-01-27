from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime
from collections import Counter

app = FastAPI()


class EventAnalyzeRequest(BaseModel):
    type: str  # "pii_input" | "payment" | "download"
    url: HttpUrl
    meta: Optional[Dict[str, Any]] = None


class EventAnalyzeResponse(BaseModel):
    reasons: List[str]


class BatchEvent(BaseModel):
    ts: datetime
    type: str
    url: HttpUrl
    meta: Optional[Dict[str, Any]] = None


class BatchAnalyzeRequest(BaseModel):
    events: List[BatchEvent]


class BatchAnalyzeResponse(BaseModel):
    summary: Dict[str, Any]


def _analyze_event_reasons(event_type: str, meta: Optional[Dict[str, Any]]) -> List[str]:
    reasons: List[str] = []
    if event_type == "pii_input":
        reasons.append("pii_input")
    elif event_type == "payment":
        reasons.append("payment_attempt")
    elif event_type == "download":
        reasons.append("download_attempt")
    else:
        reasons.append("unknown_event_type")

    if not meta:
        return reasons

    if event_type == "pii_input":
        fields = meta.get("fields")
        if isinstance(fields, list) and fields:
            reasons.append("pii_fields_present")
    elif event_type == "payment":
        if meta.get("card"):
            reasons.append("card_present")
        if meta.get("amount"):
            reasons.append("payment_amount_present")
    elif event_type == "download":
        if isinstance(meta.get("filename"), str):
            reasons.append("download_filename_present")
    return reasons


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze/event", response_model=EventAnalyzeResponse)
async def analyze_event(req: EventAnalyzeRequest):
    return EventAnalyzeResponse(reasons=_analyze_event_reasons(req.type, req.meta))


@app.post("/analyze/batch", response_model=BatchAnalyzeResponse)
async def analyze_batch(req: BatchAnalyzeRequest):
    reason_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()
    events_out: List[Dict[str, Any]] = []

    for event in req.events:
        type_counts[event.type] += 1
        reasons = _analyze_event_reasons(event.type, event.meta)
        reason_counts.update(reasons)

        events_out.append(
            {
                "ts": event.ts.isoformat(),
                "type": event.type,
                "url": str(event.url),
                "reasons": reasons,
            }
        )

    summary = {
        "total_events": len(req.events),
        "event_types": dict(type_counts),
        "reasons": dict(reason_counts),
        "events": events_out,
    }

    return BatchAnalyzeResponse(summary=summary)
