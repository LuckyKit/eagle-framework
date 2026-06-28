# Python Project Structure

## Preferred Layout

Follow the existing project first. For a backend service, a typical structure is:

```text
backend/
├── app/
│   ├── api/
│   ├── services/
│   ├── repositories/
│   ├── domain/
│   ├── schemas/
│   ├── config/
│   └── main.py
├── tests/
├── migrations/
└── pyproject.toml
```

Root-level Python projects may use:

```text
src/
tests/
pyproject.toml
```

## Boundaries

- API/router/controller modules parse input, call services, and shape responses.
- Service modules own workflows, transactions, and business rules.
- Repository/client modules own database and external service access.
- Domain modules own pure rules, value objects, and reusable validation.
- Schema/model modules own serialization contracts and input/output shapes.

## Import Rules

- Domain code should not import API/router modules.
- Service code may depend on repositories/clients through the project's existing pattern.
- Avoid circular imports by moving shared types to domain/schema modules.
- Keep framework globals out of low-level modules.

## Data Changes

- Database schema changes should include migrations when the project uses migrations.
- API contract changes should update affected clients or documented contracts.
- Background job changes should document retry and idempotency behavior.
