from pydantic import BaseModel


class CliUsage(BaseModel):
    """The tokens a `claude --print` call reports."""

    input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    output_tokens: int = 0


class CliResult(BaseModel):
    """What `claude --print --output-format json` writes to stdout."""

    is_error: bool
    # The answer's text, or the error's message.
    result: str = ""
    usage: CliUsage | None = None
