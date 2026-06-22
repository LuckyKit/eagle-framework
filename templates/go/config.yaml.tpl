server:
  addr: ":8080"
  timeout: 30

database:
  url: "${DATABASE_URL}"
  max_conn: 10
  max_idle: 5

jwt:
  secret: "${JWT_SECRET}"
  access_expiry: "1h"
  refresh_expiry: "168h"
