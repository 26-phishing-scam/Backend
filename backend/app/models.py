from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union, Annotated

from pydantic import BaseModel, Field, HttpUrl

EventType = Literal[
    "pii_input",
    "payment",
    "download",
    "login",
    "password_input",
    "clipboard",
    "redirect",
    "form_submit",
]


class BaseEvent(BaseModel):
    type: EventType
    url: HttpUrl


class PiiInputMeta(BaseModel):
    fields: Optional[List[str]] = None
    count: Optional[int] = None
    has_ssn: Optional[bool] = None
    has_phone: Optional[bool] = None
    has_email: Optional[bool] = None
    has_address: Optional[bool] = None


class PaymentMeta(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    card_bin: Optional[str] = None
    card_present: Optional[bool] = None
    merchant_domain: Optional[str] = None


class DownloadMeta(BaseModel):
    filename: Optional[str] = None
    file_ext: Optional[str] = None
    mime: Optional[str] = None
    size_bytes: Optional[int] = None
    from_new_domain: Optional[bool] = None


class LoginMeta(BaseModel):
    username_present: Optional[bool] = None
    username_field_name: Optional[str] = None
    form_action_domain: Optional[str] = None
    page_domain: Optional[str] = None


class PasswordInputMeta(BaseModel):
    password_field_present: Optional[bool] = None
    strength: Optional[str] = None
    form_action_domain: Optional[str] = None
    page_domain: Optional[str] = None


class ClipboardMeta(BaseModel):
    action: Optional[Literal["read", "write"]] = None
    contains_crypto_address: Optional[bool] = None


class RedirectMeta(BaseModel):
    chain_length: Optional[int] = None
    final_domain: Optional[str] = None


class FormSubmitMeta(BaseModel):
    form_action_domain: Optional[str] = None
    page_domain: Optional[str] = None
    has_file_upload: Optional[bool] = None
    has_payment_fields: Optional[bool] = None


EventMeta = Union[
    PiiInputMeta,
    PaymentMeta,
    DownloadMeta,
    LoginMeta,
    PasswordInputMeta,
    ClipboardMeta,
    RedirectMeta,
    FormSubmitMeta,
]


class PiiInputEvent(BaseEvent):
    type: Literal["pii_input"]
    meta: Optional[PiiInputMeta] = None


class PaymentEvent(BaseEvent):
    type: Literal["payment"]
    meta: Optional[PaymentMeta] = None


class DownloadEvent(BaseEvent):
    type: Literal["download"]
    meta: Optional[DownloadMeta] = None


class LoginEvent(BaseEvent):
    type: Literal["login"]
    meta: Optional[LoginMeta] = None


class PasswordInputEvent(BaseEvent):
    type: Literal["password_input"]
    meta: Optional[PasswordInputMeta] = None


class ClipboardEvent(BaseEvent):
    type: Literal["clipboard"]
    meta: Optional[ClipboardMeta] = None


class RedirectEvent(BaseEvent):
    type: Literal["redirect"]
    meta: Optional[RedirectMeta] = None


class FormSubmitEvent(BaseEvent):
    type: Literal["form_submit"]
    meta: Optional[FormSubmitMeta] = None


EventAnalyzeRequest = Annotated[
    Union[
        PiiInputEvent,
        PaymentEvent,
        DownloadEvent,
        LoginEvent,
        PasswordInputEvent,
        ClipboardEvent,
        RedirectEvent,
        FormSubmitEvent,
    ],
    Field(discriminator="type"),
]


class EventAnalyzeResponse(BaseModel):
    reasons: List[str]


AnalyzeStatus = Literal["SAFE", "CAUTION", "DANGER", "UNKNOWN"]
DetectionSource = Literal["WHITELIST", "BLACKLIST", "AI"]


class UrlAnalyzeRequest(BaseModel):
    url: HttpUrl


class UrlAnalyzeResponse(BaseModel):
    status: AnalyzeStatus
    detection_source: DetectionSource
    reports: List[str]


class PiiInputBatchEvent(PiiInputEvent):
    ts: datetime


class PaymentBatchEvent(PaymentEvent):
    ts: datetime


class DownloadBatchEvent(DownloadEvent):
    ts: datetime


class LoginBatchEvent(LoginEvent):
    ts: datetime


class PasswordInputBatchEvent(PasswordInputEvent):
    ts: datetime


class ClipboardBatchEvent(ClipboardEvent):
    ts: datetime


class RedirectBatchEvent(RedirectEvent):
    ts: datetime


class FormSubmitBatchEvent(FormSubmitEvent):
    ts: datetime


BatchEvent = Annotated[
    Union[
        PiiInputBatchEvent,
        PaymentBatchEvent,
        DownloadBatchEvent,
        LoginBatchEvent,
        PasswordInputBatchEvent,
        ClipboardBatchEvent,
        RedirectBatchEvent,
        FormSubmitBatchEvent,
    ],
    Field(discriminator="type"),
]


class BatchAnalyzeRequest(BaseModel):
    url: HttpUrl
    events: List[BatchEvent]


class BatchAnalyzeResponse(BaseModel):
    summary: Dict[str, Any]
    phishing: UrlAnalyzeResponse


class StoredEvent(BaseModel):
    ts: datetime
    type: EventType
    url: HttpUrl
    meta: Optional[Dict[str, Any]] = None
    reasons: Optional[List[str]] = None
    ok: Optional[bool] = None


class DomainIn(BaseModel):
    url: HttpUrl
