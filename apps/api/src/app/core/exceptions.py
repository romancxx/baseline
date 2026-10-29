from typing import ClassVar


class AppError(Exception):
    """Base class for errors that services raise and the API reports to the client."""

    code: ClassVar[str] = "app_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    code = "not_found"


class ConflictError(AppError):
    code = "conflict"


class UnauthorizedError(AppError):
    code = "unauthorized"


class ProviderUnavailableError(AppError):
    code = "provider_unavailable"


class InvalidFileError(AppError):
    code = "invalid_file"


class FileTooLargeError(AppError):
    code = "file_too_large"
