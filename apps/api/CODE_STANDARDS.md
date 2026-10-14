# Code standards

The rules every change to the API follows. Each rule is tagged with what holds it in place:

- **[lint]** ruff (`pyproject.toml`) — fails `just api-lint`.
- **[pyright]** pyright (`pyproject.toml`) — fails `just api-typecheck`.
- **[test]** A test fails if the rule is broken.
- **[review]** Convention only. Nothing catches it but a reader, so read for it.

Run `just api-lint`, `just api-typecheck` and `just api-test` before considering a change done.

---

## 1. Architecture

### 1.1 Layout

```
src/app/
  main.py               create_app(): builds the app, mounts every router
  core/                 app-wide code shared by all modules (config.py)
  modules/<feature>/    one package per feature
tests/
```

Folders follow **features**, not file types. Adding a feature means adding a module, not
touching shared folders. **[review]**

### 1.2 Module file vocabulary

A module has only the files it needs, but a file name always means the same thing. Do not
invent a new name for something one of these covers, and do not create empty files or modules
for future features. **[review]**

| File | Holds |
| --- | --- |
| `router.py` | The `APIRouter` and its endpoints |
| `schemas.py` | Pydantic request and response models: the module's API contract |
| `models.py` | Database-facing types: table rows as the database stores them |
| `service.py` | Business logic and data access |
| `dependencies.py` | Functions the router injects with `Depends()` |

- **Routers are thin**: read the request, call a service or dependency, return a schema.
  **[review]**
- **Services know nothing about HTTP**: no `Request`, `Response`, `HTTPException` or
  `Depends`. **[review]**

### 1.3 Dependency rules

1. **Imports are absolute everywhere**: `from app.modules.health.schemas import HealthResponse`,
   never `from .schemas import …`. **[lint]**
2. **`core/` never imports from `modules/`.** **[review]**
3. **A module may import another module's `service.py` or `schemas.py`, never its router.**
   **[review]**
4. **Routers are mounted only in `create_app()`.** **[review]**

## 2. Routers and endpoints

- **A router sets its own prefix and tag**, both named after the module:
  `APIRouter(prefix="/health", tags=["health"])`. **[review]**
- **`create_app()` mounts every router under `/api/v1`.** **[review]**
- **The response model is the return annotation** (`-> HealthResponse`). Use
  `response_model=` only when the function returns a different type than the one exposed.
  **[pyright]**
- **Endpoints return a schema instance, never a `dict`.** **[review]**
- **`async def` by default; plain `def` when the endpoint calls blocking code** (a sync
  driver, `requests`, `time.sleep`). Never call blocking code inside an `async def`.
  **[review]**

## 3. Python and typing

- **pyright is strict on `src/`**, standard on `tests/`. Never loosen it locally. **[pyright]**
- **Every function annotates its parameters and return type**, tests included
  (`def test_…() -> None`). **[pyright]** in `src/`, **[review]** in `tests/`.
- **No `Any`, `cast()` or `# type: ignore` to silence our own code**; only at an untyped
  third-party boundary. **[review]**
- **Modern syntax**: `list[str]`, `X | None`, `collections.abc` types. **[lint]**
- **A fixed set of string values is a `StrEnum`** (`Environment`), not bare strings.
  **[review]**
- **PEP 8 naming**: `snake_case` modules, functions and variables; `PascalCase` classes;
  `SCREAMING_SNAKE_CASE` module-level constants. **[review]**
- **Response schemas are named `<Name>Response`** (`HealthResponse`). **[review]**

## 4. Settings

- **`Settings` holds only values that vary between deployments** (environment, debug, and
  later URLs and secrets). Values that are the same everywhere are constants in code.
  **[review]**
- **Code reads settings through `get_settings()`**, never `os.environ` or a module-level
  `Settings()`. **[review]**
- **Every setting is in `Settings` and in `.env.example`.** Add the field before the `.env`
  key: an unknown key in `.env` fails at startup. **[review]**

## 5. Testing

- **Tests build the app with `create_app()` through a fixture**, never the module-level
  `app`. **[review]**
- **Settings are overridden with `monkeypatch.setenv`** and `get_settings.cache_clear()`
  before and after the test. **[review]**
- **Test names describe behaviour**: `test_<subject>_<behaviour>`
  (`test_health_returns_ok`). **[review]**

## 6. Comments

- **Comments describe the code**: what a value is or what a block does. **[review]**
- **Comments do not argue for implementation choices.** Reasoning goes in the commit
  message or the docs. **[review]**
- **Only comment what the code cannot say itself**, in one line where possible. If deleting
  the comment loses no information, delete it. **[review]**

## 7. Tooling

- **uv only.** Add dependencies with `uv add` (`--dev` for tooling); never hand-edit
  `uv.lock`. **[review]**
- **Formatting is ruff's** (100 columns). Run `just api-format`; do not hand-format.
  **[review]**

---

## Checklist: adding a module

1. Create `src/app/modules/<name>/` with an `__init__.py` and only the files from §1.2 it
   needs.
2. In `router.py`: `APIRouter(prefix="/<name>", tags=["<name>"])`.
3. Mount the router in `create_app()`.
4. Add tests that build the app with `create_app()`.
