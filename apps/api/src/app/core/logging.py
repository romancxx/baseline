import logging
import sys

import structlog
from structlog.typing import Processor

from app.core.config import Environment

# Applied to every record: ours from structlog, and the standard-library ones (uvicorn, ...).
SHARED_PROCESSORS: list[Processor] = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_logger_name,
    structlog.stdlib.add_log_level,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
]


def configure_logging(environment: Environment) -> None:
    """Send all logs through structlog: readable console output locally, JSON elsewhere."""
    structlog.configure(
        processors=[*SHARED_PROCESSORS, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
    )

    renderer: list[Processor] = (
        [structlog.dev.ConsoleRenderer()]
        if environment is Environment.LOCAL
        else [structlog.processors.format_exc_info, structlog.processors.JSONRenderer()]
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=SHARED_PROCESSORS,
            processors=[structlog.stdlib.ProcessorFormatter.remove_processors_meta, *renderer],
        )
    )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)

    # uvicorn installs its own handlers before loading the app; route its logs to ours instead.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
    # The request middleware logs each request once; uvicorn's access line would repeat it.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
