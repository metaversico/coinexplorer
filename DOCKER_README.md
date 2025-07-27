# Docker Compose Setup

This repository contains two Docker Compose configurations:

## Application Services (`docker-compose.apps.yml`)

Starts all application services:
- **API** (port 8000) - Deno-based REST API
- **WWW** (port 3000) - React frontend with Nginx
- **ADM** (port 8080) - Administration service
- **Postgres** (port 5432) - Database for applications

### Usage

```bash
# Start all application services
docker-compose -f docker-compose.apps.yml up -d

# View logs
docker-compose -f docker-compose.apps.yml logs -f

# Stop services
docker-compose -f docker-compose.apps.yml down
```

## Infrastructure Services (`docker-compose.infra.yml`)

Starts observability and infrastructure services:
- **Postgres** (port 5432) - Database
- **Postgres Exporter** (port 9187) - Postgres metrics for Prometheus
- **Vector** (port 8686) - Log aggregation
- **Loki** (port 3100) - Log storage
- **Prometheus** (port 9090) - Metrics storage and alerting
- **Grafana** (port 3001) - Dashboards and visualization

### Usage

```bash
# Start infrastructure services
docker-compose -f docker-compose.infra.yml up -d

# View logs
docker-compose -f docker-compose.infra.yml logs -f

# Stop services
docker-compose -f docker-compose.infra.yml down
```

## Combined Usage

To run both application and infrastructure services:

```bash
# Start infrastructure first
docker-compose -f docker-compose.infra.yml up -d

# Start applications
docker-compose -f docker-compose.apps.yml up -d

# Or start both together
docker-compose -f docker-compose.infra.yml -f docker-compose.apps.yml up -d
```

## Service Access

### Application Services
- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **Admin**: http://localhost:8080

### Infrastructure Services
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100

## Development

For development, you can still use the existing Deno tasks:
```bash
deno task dev:api    # Development API server
deno task dev:www    # Development frontend
deno task adm:main   # Development admin server
```

## Notes

- The `coinexplorer-network` bridge network connects all services
- Database data is persisted in named volumes
- All services are configured to restart automatically unless stopped
- Grafana and Prometheus data are persisted across container restarts