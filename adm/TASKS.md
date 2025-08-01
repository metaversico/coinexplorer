- [] Implement adm/http Oak server with endpoints:
  - [] POST /jobs/:jobname/run (trigger job run via adm/run subprocess)
  - [] GET /runs/:id (fetch run status)
  - [] GET /schedule (serve static schedule from jobschedule.yml)
  - [] GET /metrics (serve Prometheus-compatible metrics, including per-job metrics)
- [] Implement adm/run to execute @coinexplorer/jobs with standard metrics and logging
- [] Integrate adm/run with adm/http for job execution
- [] Implement adm/init to set up cronjobs from jobschedule.yml, triggering job runs via adm/http
- [] Ensure adm/init is idempotent and runs after each update
- [] Implement logging, metrics, and run status outputs for all job executions
- [] Document API usage and setup in adm/http/README
- [] Add integration tests for all endpoints and job orchestration
- [] Ensure compatibility with Prometheus metrics scraping
- [] Ensure all modules are deterministic and testable in isolation
- [] Add structured JSON logging for all job runs and side effects
- [] Document deployment and local development instructions 