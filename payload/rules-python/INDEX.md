# Python Rules Index

Python backend work should follow existing project conventions first. Use these rules when the project has `pyproject.toml`, `requirements.txt`, `poetry.lock`, `Pipfile`, or Python packages under `backend/`.

## Files

- `code-style.md` — typing, errors, async boundaries, logging, configuration
- `project-structure.md` — package layout, API/service/repository boundaries, migration placement
- `testing.md` — pytest layout, unit/integration tests, fixtures, quality commands

## Agent Checklist

- Read nearby modules before introducing a new pattern.
- Keep framework-specific code at the edge: route/controller layer, CLI entry, worker entry.
- Keep business rules in services/domain modules with focused tests.
- Prefer explicit types and small functions over hidden dynamic behavior.
- Record reusable decisions in `.eagle/knowledge/INDEX.md`.
