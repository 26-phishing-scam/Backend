from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import get_cors_settings
from .routers.analysis import router as analysis_router
from .routers.meta import router as meta_router
from .routers.store import router as store_router

app = FastAPI()

origins, origin_regex = get_cors_settings()
if origins or origin_regex:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_failed",
            "detail": exc.errors(),
            "body": exc.body,
        },
    )


app.include_router(meta_router)
app.include_router(analysis_router)
app.include_router(store_router)
