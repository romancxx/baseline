from collections.abc import Callable, Coroutine, Mapping
from http import HTTPStatus
from typing import Any

from fastapi import Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from app.core.exceptions import AppError, ConflictError, NotFoundError


class ErrorDetail(BaseModel):
    loc: list[str | int]
    message: str
    type: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


STATUS_CODES: dict[type[AppError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ConflictError: status.HTTP_409_CONFLICT,
}


async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    return _error_response(_status_code(exc), exc.code, exc.message)


async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        ErrorDetail(loc=list(error["loc"]), message=error["msg"], type=error["type"])
        for error in exc.errors()
    ]
    return _error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "validation_error",
        "The request is invalid.",
        details,
    )


async def handle_http_exception(_request: Request, exc: HTTPException) -> JSONResponse:
    """Errors raised by FastAPI itself, such as an unknown route (404) or method (405)."""
    code = HTTPStatus(exc.status_code).phrase.lower().replace(" ", "_")
    return _error_response(exc.status_code, code, exc.detail, headers=exc.headers)


def _status_code(exc: AppError) -> int:
    for error_class, status_code in STATUS_CODES.items():
        if isinstance(exc, error_class):
            return status_code
    return status.HTTP_500_INTERNAL_SERVER_ERROR


def _error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(code=code, message=message, details=details)
    return JSONResponse(body.model_dump(mode="json"), status_code=status_code, headers=headers)


# The value type is FastAPI's, from its `exception_handlers` parameter.
EXCEPTION_HANDLERS: dict[
    int | type[Exception], Callable[[Request, Any], Coroutine[Any, Any, Response]]
] = {
    AppError: handle_app_error,
    RequestValidationError: handle_validation_error,
    HTTPException: handle_http_exception,
}
