from pydantic import BaseModel


class TokenResponse(BaseModel):
    """OAuth2 token response; Swagger UI's Authorize button reads `access_token`."""

    access_token: str
    token_type: str
    # Seconds until the token expires.
    expires_in: int
