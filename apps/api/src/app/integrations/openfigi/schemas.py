from pydantic import BaseModel


class FigiCandidate(BaseModel):
    """A listing of a security, found by its ISIN."""

    yahoo_symbol: str
    # e.g. FP for Euronext Paris, GY for Xetra.
    bloomberg_exchange_code: str
    share_class_figi: str
