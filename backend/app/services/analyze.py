from typing import List, Optional

from ..models import (
    BaseEvent,
    ClipboardMeta,
    DownloadMeta,
    EventMeta,
    FormSubmitMeta,
    LoginMeta,
    PasswordInputMeta,
    PaymentMeta,
    PiiInputMeta,
    RedirectMeta,
)


def analyze_event_reasons(event: BaseEvent) -> List[str]:
    reasons: List[str] = []
    reasons.append(event.type)
    meta: Optional[EventMeta] = getattr(event, "meta", None)
    if meta is None:
        reasons.append("meta_missing")
        return reasons

    if event.type == "pii_input" and isinstance(meta, PiiInputMeta):
        if meta.fields:
            reasons.append("pii_fields_present")
        if meta.count and meta.count >= 3:
            reasons.append("multiple_pii_fields")
        if meta.has_ssn:
            reasons.append("ssn_present")
        if meta.has_phone:
            reasons.append("phone_present")
        if meta.has_email:
            reasons.append("email_present")
        if meta.has_address:
            reasons.append("address_present")
    elif event.type == "payment" and isinstance(meta, PaymentMeta):
        if meta.card_present:
            reasons.append("card_present")
        if meta.amount:
            reasons.append("payment_amount_present")
        if meta.card_bin:
            reasons.append("card_bin_present")
        if meta.merchant_domain:
            reasons.append("merchant_domain_present")
    elif event.type == "download" and isinstance(meta, DownloadMeta):
        if meta.filename:
            reasons.append("download_filename_present")
        if meta.file_ext:
            reasons.append("download_ext_present")
        if meta.file_ext and meta.file_ext.lower() in ["exe", "msi", "bat", "cmd", "js", "vbs", "ps1", "scr"]:
            reasons.append("download_risky_extension")
        if meta.from_new_domain:
            reasons.append("download_from_new_domain")
    elif event.type == "login" and isinstance(meta, LoginMeta):
        if meta.username_present:
            reasons.append("username_present")
        if meta.form_action_domain and meta.page_domain and meta.form_action_domain != meta.page_domain:
            reasons.append("form_action_domain_mismatch")
    elif event.type == "password_input" and isinstance(meta, PasswordInputMeta):
        if meta.password_field_present:
            reasons.append("password_present")
        if meta.form_action_domain and meta.page_domain and meta.form_action_domain != meta.page_domain:
            reasons.append("form_action_domain_mismatch")
    elif event.type == "clipboard" and isinstance(meta, ClipboardMeta):
        if meta.action == "write":
            reasons.append("clipboard_write")
        if meta.contains_crypto_address:
            reasons.append("crypto_address_present")
    elif event.type == "redirect" and isinstance(meta, RedirectMeta):
        if meta.chain_length and meta.chain_length >= 3:
            reasons.append("redirect_chain_long")
        if meta.final_domain:
            reasons.append("redirect_final_domain_present")
    elif event.type == "form_submit" and isinstance(meta, FormSubmitMeta):
        if meta.form_action_domain and meta.page_domain and meta.form_action_domain != meta.page_domain:
            reasons.append("form_action_domain_mismatch")
        if meta.has_file_upload:
            reasons.append("file_upload_present")
        if meta.has_payment_fields:
            reasons.append("payment_fields_present")

    return reasons
