from datetime import datetime, timezone


def to_utc_iso(value: datetime) -> str:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
