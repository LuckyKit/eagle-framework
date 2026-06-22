# Python Code Style

## Core Principles

- Prefer clear, typed Python over clever dynamic behavior.
- Match the existing framework and package style before introducing a new abstraction.
- Keep side effects at the edge: HTTP handlers, CLI commands, workers, database adapters.
- Keep business logic in service/domain modules that are easy to test.

## Typing

- Add type hints for public functions, service methods, repository methods, and dataclasses/Pydantic models.
- Use `None` explicitly in return types when a function can return nothing meaningful.
- Prefer `TypedDict`, dataclasses, or Pydantic models for structured data that crosses module boundaries.
- Avoid passing raw dictionaries through multiple layers unless the project already does that consistently.

## Errors

- Raise domain-specific exceptions inside business logic.
- Convert exceptions to HTTP responses or CLI messages only at the boundary.
- Do not swallow exceptions silently. If a failure is intentionally ignored, leave a short reason.
- Include enough context in logs to debug the failure without leaking secrets.

## Async

- Do not mix sync and async database/client calls in the same path unless the framework requires it.
- Await all async calls directly or gather them intentionally.
- Keep long-running work out of request handlers; use tasks/workers when the project has that pattern.

## Configuration

- Read configuration from the project's established config layer.
- Do not read environment variables deep inside domain logic.
- Avoid hardcoded credentials, hosts, region names, or feature flags.

## Logging

- Use the project's logger instead of `print`.
- Log at boundaries and important state transitions.
- Avoid logging tokens, passwords, cookies, private keys, and raw personal data.
