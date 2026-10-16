import re
import time
import uuid

import structlog
from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.error_handlers import error_response

REQUEST_ID_HEADER = "X-Request-ID"
# An incoming ID is reused only if it looks like an ID, so clients cannot inject log content.
VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

logger = structlog.stdlib.get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Give each request an ID, bind it to the log context, and log the request once it ends.

    An exception the app did not handle is logged here and answered with a 500 in the usual
    error shape, so that response carries the request ID too.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming_id = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming_id if VALID_REQUEST_ID.match(incoming_id) else str(uuid.uuid4())

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("http.unhandled_error")
            response = error_response(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "internal_error",
                "An unexpected error occurred.",
            )

        logger.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
