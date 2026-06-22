# Python Testing

## Default Commands

Use the command already defined by the project. Common defaults:

```bash
pytest
python -m pytest
```

If the project uses Poetry or uv:

```bash
poetry run pytest
uv run pytest
```

## Test Layout

- Prefer `tests/` for integration and service tests.
- Keep unit tests close to small pure modules only when the project already does that.
- Use names like `test_*.py` or `*_test.py`.

## What To Cover

- Service happy path and important failure paths.
- Repository queries when query shape or transaction behavior changes.
- API handlers for request validation, status codes, and response shape.
- Background workers for retry, idempotency, and partial failure.

## Fixtures

- Keep fixtures explicit and local unless shared setup is genuinely reused.
- Avoid large global fixtures that hide test data.
- Reset database/cache state between integration tests when tests mutate shared state.

## Quality Gate

Before marking work done:

- Run the narrowest relevant test first.
- Run the broader project test command when the change touches shared behavior.
- Record commands and results in `.eagle/tasks/{slug}/TEST.md`.
- If a test cannot run locally, record the reason and the remaining risk.
