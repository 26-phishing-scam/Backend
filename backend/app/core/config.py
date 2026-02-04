import os
from pathlib import Path
from typing import List, Optional, Tuple

try:
    from dotenv import load_dotenv, find_dotenv

    # Prefer repo root `.env`, fallback to `backend/.env`, then any discoverable `.env`.
    root = Path(__file__).resolve().parents[3]
    candidates = [root / ".env", root / "backend" / ".env"]
    for path in candidates:
        if path.exists():
            load_dotenv(path)
            break
    else:
        load_dotenv(find_dotenv())
except Exception:
    pass


def get_cors_settings() -> Tuple[List[str], Optional[str]]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    else:
        env = os.getenv("APP_ENV", "local").lower()
        origins = ["http://localhost:5173", "http://localhost:3000"] if env in {"local", "dev", "development"} else []

    env_name = os.getenv("APP_ENV", "local").lower()
    origin_regex = r"^chrome-extension://[a-p]{32}$" if env_name in {"local", "dev", "development"} else None
    return origins, origin_regex
