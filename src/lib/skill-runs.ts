import { failure } from "./mcp-connections";
import type { AttachmentRef } from "./attachments";
import type { OutputRef } from "./outputs";

/** One recorded Skill Run, from deepagent-aegra's `/skill-runs` API (contract in
 * deepagent-aegra/agent/skills/app.py's module docstring). `skillState` says whether
 * the Skill is still the one the Run used: no snapshot is kept, so it can only be
 * `"removed"` (deleted) or `"updated"` (replaced since). */
export interface SkillRunRecord {
  id: string;
  skill: string;
  startedAt: string;
  installedAt: string;
  fields: Record<string, unknown>;
  files: Record<string, AttachmentRef[]>;
  status: "running" | "done" | "failed" | "cancelled";
  finalMessage: string | null;
  outputs: OutputRef[];
  skillState: "removed" | "updated" | null;
}

/** Newest first; every Skill's Runs without `skill`. */
export async function listSkillRuns(
  apiUrl: string,
  skill?: string,
): Promise<SkillRunRecord[]> {
  const query = skill ? `?skill=${encodeURIComponent(skill)}` : "";
  const res = await fetch(`${apiUrl}/skill-runs${query}`);
  if (!res.ok) throw await failure(res);
  return res.json();
}

export async function getSkillRun(
  apiUrl: string,
  id: string,
): Promise<SkillRunRecord> {
  const res = await fetch(`${apiUrl}/skill-runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw await failure(res);
  return res.json();
}

export const historyHref = (apiUrl: string, skill: string, run?: string) =>
  `/skills/history?apiUrl=${encodeURIComponent(apiUrl)}&skill=${encodeURIComponent(skill)}` +
  (run ? `&run=${encodeURIComponent(run)}` : "");
