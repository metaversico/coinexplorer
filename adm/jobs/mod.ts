export type JobRunResult = {
  runId: string;
  job: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: string;
};

/**
 * Run a job by name. This is a stub; real logic should dispatch to job modules.
 */
export async function runJob(name: string, params?: Record<string, unknown>): Promise<JobRunResult> {
  // TODO: Implement actual job dispatch and tracking
  const now = new Date().toISOString();
  return {
    runId: crypto.randomUUID(),
    job: name,
    status: 'success',
    startedAt: now,
    finishedAt: new Date().toISOString(),
    result: { message: `Job '${name}' ran successfully (stub)` },
  };
} 