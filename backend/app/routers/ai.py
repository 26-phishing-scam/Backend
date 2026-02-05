from fastapi import APIRouter

from ..models import UrlAnalyzeRequest, UrlAnalyzeResponse
from ..services.ai_client import fetch_ai_analysis

router = APIRouter()


@router.post("/analyze/url", response_model=UrlAnalyzeResponse)
async def analyze_url(req: UrlAnalyzeRequest):
    return await fetch_ai_analysis(str(req.url))
