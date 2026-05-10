"""Typed error responses + exception handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class CivicSimError(Exception):
    """Base error type for known, returnable failure modes."""

    status_code: int = 400
    code: str = "civicsim_error"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class LocationNotFoundError(CivicSimError):
    status_code = 404
    code = "location_not_found"


class QuestionNotFoundError(CivicSimError):
    status_code = 404
    code = "question_not_found"


class PriorsUnavailableError(CivicSimError):
    status_code = 503
    code = "priors_unavailable"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(CivicSimError)
    async def _civicsim_handler(_: Request, exc: CivicSimError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=jsonable_encoder(
                {
                    "error": {
                        "code": "validation_error",
                        "message": "Invalid request",
                        "details": exc.errors(),
                    }
                }
            ),
        )
