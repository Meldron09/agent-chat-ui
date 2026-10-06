import type { Message } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { AttachmentRef } from "./attachments";
import { webSearchConfigForRun } from "./web-search";

/** Thread metadata that marks a Skill Run's thread. The chat list drops threads
 * carrying it (`isChatThread`); the thread search can only match by containment,
 * so it cannot exclude them itself (deepagent-aegra ADR-0011). */
export const SKILL_RUN_METADATA = { skill_run: true };

export const isChatThread = (thread: { metadata?: Record<string, unknown> | null }) =>
  !thread.metadata?.skill_run;

/** What `stream.submit` needs to start a Skill Run on the Orchestrator: an
 * ordinary human message plus `configurable.skill_run`, which deepagent-aegra's
 * `SkillRunMiddleware` (agent/skill_run.py) turns into the Skill's instructions,
 * the `fields` JSON block, and Attachments. The fallback screen has one free-text
 * field, `text`, and one file field, `files`. */
export function skillRunInput({
  skill,
  text,
  files,
  enableWebSearch,
}: {
  skill: string;
  text: string;
  files: AttachmentRef[];
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
            fields: { text },
            files: files.length > 0 ? { files } : {},
          },
        },
      },
    },
  };
}

export type SkillRunStatus = "idle" | "running" | "done" | "failed";

export function skillRunStatus({
  isLoading,
  error,
  started,
}: {
  isLoading: boolean;
  error?: unknown;
  started?: boolean;
}): SkillRunStatus {
  if (error) return "failed";
  if (isLoading) return "running";
  return started ? "done" : "idle";
}
