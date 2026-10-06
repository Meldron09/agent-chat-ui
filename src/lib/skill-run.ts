import type { Message } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { AttachmentRef } from "./attachments";
import { webSearchConfigForRun } from "./web-search";

/** Thread metadata that marks a Skill Run's thread. The chat list drops threads
 * carrying it (`isChatThread`); the thread search can only match by containment,
 * so it cannot exclude them itself (deepagent-aegra ADR-0011). */
export const SKILL_RUN_METADATA = { skill_run: true };

export const isChatThread = (thread: {
  metadata?: Record<string, unknown> | null;
}) => !thread.metadata?.skill_run;

/** What `stream.submit` needs to start a Skill Run on the Orchestrator: an
 * ordinary human message plus `configurable.skill_run`, which deepagent-aegra's
 * `SkillRunMiddleware` (agent/skill_run.py) turns into the Skill's instructions,
 * the `fields` JSON block, and Attachments keyed by field name. The fallback screen
 * has one free-text field, `text`, and one file field, `files`; a Skill UI names its own. */
export function skillRunInput({
  skill,
  fields,
  files,
  enableWebSearch,
}: {
  skill: string;
  fields: Record<string, unknown>;
  files: Record<string, AttachmentRef[]>;
  enableWebSearch: boolean;
}) {
  const message: Message = {
    id: uuidv4(),
    type: "human",
    content: `Run the Skill "${skill}".`,
  };
  const { configurable } = webSearchConfigForRun(enableWebSearch);
  return {
    input: { messages: [message] },
    options: {
      metadata: SKILL_RUN_METADATA,
      config: {
        configurable: {
          ...configurable,
          skill_run: {
            name: skill,
            fields,
            files: Object.fromEntries(
              Object.entries(files).filter(([, list]) => list.length > 0),
            ),
          },
        },
      },
    },
  };
}

export type SkillRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

/** The status the server reports for a Run through a custom stream event
 * (`{skill_run_status: "queued" | "running"}`, deepagent-aegra agent/skill_run.py):
 * only one Skill Run is active at a time, so a Run submitted meanwhile waits. */
export const queuedFromEvent = (event: unknown): boolean | undefined => {
  const status = (event as { skill_run_status?: unknown } | null)
    ?.skill_run_status;
  return status === "queued" ? true : status === "running" ? false : undefined;
};

/** `finished` comes from the stream's `onFinish`, not from `!isLoading`: right
 * after submit, `isLoading` is still false for a moment, which would read as done. */
export function skillRunStatus({
  isLoading,
  error,
  started,
  finished,
  queued = false,
  cancelled = false,
}: {
  isLoading: boolean;
  error?: unknown;
  started: boolean;
  finished: boolean;
  queued?: boolean;
  cancelled?: boolean;
}): SkillRunStatus {
  if (cancelled) return "cancelled"; // aborting the stream may surface as an error
  if (error) return "failed";
  if (!started) return "idle";
  if (queued && !finished) return "queued";
  return isLoading || !finished ? "running" : "done";
}
