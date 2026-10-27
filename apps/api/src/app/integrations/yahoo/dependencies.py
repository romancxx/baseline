from typing import Annotated

from fastapi import Depends

from app.integrations.yahoo.client import YahooClient


def get_yahoo_client() -> YahooClient:
    return YahooClient()


Yahoo = Annotated[YahooClient, Depends(get_yahoo_client)]
