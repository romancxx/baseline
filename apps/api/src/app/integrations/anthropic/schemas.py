from pydantic import BaseModel


class Generation[T: BaseModel](BaseModel):
    """A model's answer, validated as `T`, and the tokens it cost."""

    output: T
    input_tokens: int
    output_tokens: int
