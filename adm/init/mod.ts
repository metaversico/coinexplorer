// adm/init/mod.ts
import { parse } from "jsr:@std/yaml";

const JOBSCHEDULE_PATH = new URL("../jobschedule.yml", import.meta.url).pathname;
const CRON_MARKER = "# coinexplorer jobs";

type JobSchedule = { name: string; schedule: string; job: string };

/**
 * Reads jobschedule.yml, parses jobs, and updates the user's crontab.
 * Idempotent: removes previous coinexplorer jobs before adding new ones.
 */
export default async function admInit() {
  // Read and parse jobschedule.yml
  const yamlText = await Deno.readTextFile(JOBSCHEDULE_PATH);
  let jobs: JobSchedule[] = [];
  const parsed = parse(yamlText);
  if (Array.isArray(parsed)) {
    jobs = parsed.filter(
      (j): j is JobSchedule =>
        typeof j === "object" &&
        j !== null &&
        typeof j.name === "string" &&
        typeof j.schedule === "string" &&
        typeof j.job === "string"
    );
  }

  // Read current crontab (handle case where no crontab is set)
  let crontab = "";
  try {
    const cmd = new Deno.Command("crontab", { args: ["-l"], stdout: "piped", stderr: "piped" });
    const { stdout, stderr } = await cmd.output();
    if (stderr.length === 0) {
      crontab = new TextDecoder().decode(stdout);
    }
  } catch (_) {
    // No crontab set, continue with empty
  }

  console.log("Current crontab\n\n", crontab);

  // Remove previous coinexplorer jobs
  const lines = crontab.split("\n");
  const filtered = [];
  let skip = false;
  for (const line of lines) {
    if (line.trim() === CRON_MARKER) {
      skip = true;
      continue;
    }
    if (skip && line.startsWith("# end coinexplorer jobs")) {
      skip = false;
      continue;
    }
    if (!skip) filtered.push(line);
  }

  // Build new coinexplorer job entries
  const jobLines = [CRON_MARKER];
  for (const job of jobs) {
    jobLines.push(
      `${job.schedule} curl -X POST http://localhost:8080/jobs/${job.job}/run # coinexplorer:${job.name}`
    );
  }
  jobLines.push("# end coinexplorer jobs");

  // Combine and write new crontab
  const newCrontab = [...filtered, ...jobLines].filter(Boolean).join("\n") + "\n";
  console.log("New crontab\n\n", newCrontab);

  if (newCrontab === crontab) {
    console.log("No changes to crontab");
    return;
  }

  console.log("Updating crontab");
  const cmd2 = new Deno.Command("crontab", { args: ["-"], stdin: "piped" });
  const child = cmd2.spawn();
  const writer = child.stdin.getWriter();
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(newCrontab));
  await writer.close();
  await child.status;

  console.log("Crontab updated with coinexplorer jobs.");
}