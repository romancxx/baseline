from typing import Annotated

from fastapi import Depends, Request

from app.integrations.openfigi.client import OpenFigiClient


def get_openfigi_client(request: Request) -> OpenFigiClient:
    return request.app.state.openfigi


OpenFigi = Annotated[OpenFigiClient, Depends(get_openfigi_client)]
