from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel

from ..models import (
    ClipboardMeta,
    DownloadMeta,
    EventType,
    FormSubmitMeta,
    LoginMeta,
    PasswordInputMeta,
    PaymentMeta,
    PiiInputMeta,
    RedirectMeta,
)

router = APIRouter()


def _model_schema(model: BaseModel) -> Dict[str, Any]:
    if hasattr(model, "model_json_schema"):
        return model.model_json_schema()
    return model.schema()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/schema")
async def schema():
    meta_schema = {
        "pii_input": _model_schema(PiiInputMeta),
        "payment": _model_schema(PaymentMeta),
        "download": _model_schema(DownloadMeta),
        "login": _model_schema(LoginMeta),
        "password_input": _model_schema(PasswordInputMeta),
        "clipboard": _model_schema(ClipboardMeta),
        "redirect": _model_schema(RedirectMeta),
        "form_submit": _model_schema(FormSubmitMeta),
    }

    examples = {
        "pii_input": {
            "type": "pii_input",
            "url": "https://example.com/signup",
            "meta": {"fields": ["email", "phone"], "count": 2, "has_email": True, "has_phone": True},
        },
        "payment": {
            "type": "payment",
            "url": "https://pay.example.com/checkout",
            "meta": {"amount": 49.9, "currency": "USD", "card_present": True, "merchant_domain": "example.com"},
        },
        "download": {
            "type": "download",
            "url": "https://files.example.com/setup.exe",
            "meta": {"filename": "setup.exe", "file_ext": "exe", "size_bytes": 204800},
        },
        "login": {
            "type": "login",
            "url": "https://login.example.com",
            "meta": {"username_present": True, "form_action_domain": "evil.com", "page_domain": "login.example.com"},
        },
        "password_input": {
            "type": "password_input",
            "url": "https://login.example.com",
            "meta": {"password_field_present": True, "form_action_domain": "login.example.com", "page_domain": "login.example.com"},
        },
        "clipboard": {
            "type": "clipboard",
            "url": "https://example.com",
            "meta": {"action": "write", "contains_crypto_address": True},
        },
        "redirect": {
            "type": "redirect",
            "url": "https://example.com",
            "meta": {"chain_length": 4, "final_domain": "final.example.com"},
        },
        "form_submit": {
            "type": "form_submit",
            "url": "https://example.com/upload",
            "meta": {"form_action_domain": "example.com", "page_domain": "example.com", "has_file_upload": True},
        },
    }

    return {
        "event_types": list(EventType.__args__),
        "meta_schema": meta_schema,
        "examples": examples,
    }
