from pydantic import BaseModel


class Generation[T: BaseModel](BaseModel):
    """A model's answer, validated as `T`, and the tokens it cost, when the backend says."""

    output: T
    input_tokens: int | None
    output_tokens: int | None
