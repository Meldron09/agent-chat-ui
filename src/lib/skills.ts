import { failure } from "./mcp-connections";

/** Client for deepagent-aegra's `/skills` API (contract in
 * deepagent-aegra/agent/skills/app.py's module docstring). Errors are always
 * `{"error": message}` naming the rule that failed; we show it as-is. */
export interface Skill {
  name: string;
  description: string;
  hasUi: boolean;
}

export async function listSkills(apiUrl: string): Promise<Skill[]> {
  const res = await fetch(`${apiUrl}/skills`);
  if (!res.ok) throw await failure(res);
  return res.json();
}

export async function installSkill(apiUrl: string, zip: File): Promise<Skill> {
  const body = new FormData();
  body.append("file", zip);
  const res = await fetch(`${apiUrl}/skills`, { method: "POST", body });
  if (!res.ok) throw await failure(res);
  return res.json();
}

/** Deliberately swaps the installed Skill `name` for the zip; the old one
 * stays if the new one is refused. */
export async function replaceSkill(
  apiUrl: string,
  name: string,
  zip: File,
): Promise<Skill> {
  const body = new FormData();
  body.append("file", zip);
  const res = await fetch(`${apiUrl}/skills/${encodeURIComponent(name)}`, {
    method: "PUT",
    body,
  });
  if (!res.ok) throw await failure(res);
  return res.json();
}

export async function deleteSkill(apiUrl: string, name: string): Promise<void> {
  const res = await fetch(`${apiUrl}/skills/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await failure(res);
}
