from collections import Counter
from typing import Any, Dict, List

from fastapi import APIRouter

from ..core.time import to_utc_iso
from ..models import BatchAnalyzeRequest, BatchAnalyzeResponse, EventAnalyzeRequest, EventAnalyzeResponse
from ..services.ai_client import fetch_ai_analysis
from ..services.analyze import analyze_event_reasons

router = APIRouter()


@router.post("/analyze/event", response_model=EventAnalyzeResponse)
async def analyze_event(req: EventAnalyzeRequest):
    reasons = analyze_event_reasons(req)
    return EventAnalyzeResponse(reasons=reasons)


@router.post("/analyze/batch", response_model=BatchAnalyzeResponse)
async def analyze_batch(req: BatchAnalyzeRequest):
    reason_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()

    domain_mismatch_count = 0
    risky_download_count = 0
    clipboard_write_count = 0
    crypto_address_count = 0
    redirect_chain_long_count = 0
    payment_fields_count = 0
    file_upload_count = 0

    events_out: List[Dict[str, Any]] = []

    for event in req.events:
        type_counts[event.type] += 1
        reasons = analyze_event_reasons(event)
        reason_counts.update(reasons)

        if "form_action_domain_mismatch" in reasons:
            domain_mismatch_count += 1
        if "download_risky_extension" in reasons:
            risky_download_count += 1
        if "clipboard_write" in reasons:
            clipboard_write_count += 1
        if "crypto_address_present" in reasons:
            crypto_address_count += 1
        if "redirect_chain_long" in reasons:
            redirect_chain_long_count += 1
        if "payment_fields_present" in reasons:
            payment_fields_count += 1
        if "file_upload_present" in reasons:
            file_upload_count += 1

        events_out.append(
            {
                "ts": to_utc_iso(event.ts),
                "type": event.type,
                "url": str(event.url),
                "reasons": reasons,
            }
        )

    summary = {
        "total_events": len(req.events),
        "event_types": dict(type_counts),
        "reasons": dict(reason_counts),

        # 행위 기반 위험 지표
        "form_action_domain_mismatch_events": domain_mismatch_count,
        "risky_download_events": risky_download_count,
        "clipboard_write_events": clipboard_write_count,
        "crypto_address_events": crypto_address_count,
        "redirect_chain_long_events": redirect_chain_long_count,
        "payment_fields_events": payment_fields_count,
        "file_upload_events": file_upload_count,

        # 시퀀스 분석
        "event_sequence": [event.type for event in req.events],

        # 상세 이벤트
        "events": events_out,
    }

    phishing = await fetch_ai_analysis(str(req.url))
    return BatchAnalyzeResponse(summary=summary, phishing=phishing)
