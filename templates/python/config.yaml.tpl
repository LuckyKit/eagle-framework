server:
  host: "0.0.0.0"
  port: 8000
  debug: false

database:
  host: "localhost"
  port: 5432
  name: "{{PROJECT_NAME}}"
  user: "${DATABASE_USER}"
  password: "${DATABASE_PASSWORD}"

jwt:
  algorithm: "HS256"
  access_token_expire_minutes: 30
  refresh_token_expire_days: 7

logging:
  level: "INFO"
  json_format: true
