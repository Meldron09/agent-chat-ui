/** A file `output-writer` produced during a run — the same `{key, filename}`
 * pointer shape as an Attachment (deepagent-aegra/CONTEXT.md, ADR-0001).
 * Discovered via the thread's post-run state, under the `outputs` field —
 * never parsed out of the orchestrator's chat reply. */
export interface OutputRef {
  key: string;
  filename: string;
}
