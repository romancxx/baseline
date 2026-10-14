from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


app = FastAPI()


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")
