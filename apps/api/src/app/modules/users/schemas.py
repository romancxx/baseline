import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, StringConstraints

# EmailStr validates the address but lowercases only the domain; lowercase all of it.
Email = Annotated[EmailStr, AfterValidator(str.lower)]
# Never stripped or otherwise changed: the password is hashed exactly as typed.
Password = Annotated[str, StringConstraints(min_length=12, max_length=128)]


class UserCreate(BaseModel):
    email: Email
    password: Password


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_at: datetime
    updated_at: datetime
