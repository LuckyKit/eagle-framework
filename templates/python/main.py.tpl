import asyncio
import signal
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from {{PROJECT_NAME}}.api.v1 import router as v1_router
from {{PROJECT_NAME}}.config import get_settings

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    engine = create_async_engine(settings.db_url, echo=settings.server.debug)

    app.state.engine = engine
    logger.info("database_engine_created")

    yield

    await engine.dispose()
    logger.info("database_engine_disposed")


app = FastAPI(
    title="{{PROJECT_NAME}}",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


def main() -> None:
    settings = get_settings()

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if not settings.logging.json_format
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    server = uvicorn.Server(
        config=uvicorn.Config(
            app="{{PROJECT_NAME}}.main:app",
            host=settings.server.host,
            port=settings.server.port,
            reload=settings.server.debug,
            log_level=settings.logging.level.lower(),
        )
    )

    loop = asyncio.new_event_loop()

    def handle_shutdown() -> None:
        logger.info("shutdown_signal_received")
        server.should_exit = True

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, handle_shutdown)

    try:
        loop.run_until_complete(server.serve())
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("server_stopped")


if __name__ == "__main__":
    main()
