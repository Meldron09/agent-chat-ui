import {
  isSupportedAttachment,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
  uploadFile,
  type AttachmentRef,
} from "./attachments";
import type { SkillRunStatus } from "./skill-run";

/** The host's side of the Skill UI's three-message `postMessage` contract
 * (deepagent-aegra ADR-0010; the author-facing page is
 * deepagent-aegra/docs/skill-ui-contract.md). */
export interface SkillUiSubmit {
  fields: Record<string, unknown>;
  files: Record<string, File[]>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A `submit` message from the UI, or `null` for anything else. A named file is
 * one `File` or a list of them (an empty slot is dropped); either way the host works with a list. */
export function parseSubmit(data: unknown): SkillUiSubmit | null {
  if (!isRecord(data) || data.type !== "submit") return null;
  const fields = data.fields ?? {};
  const rawFiles = data.files ?? {};
  if (!isRecord(fields) || !isRecord(rawFiles)) return null;

  const files: Record<string, File[]> = {};
  for (const [name, value] of Object.entries(rawFiles)) {
    // An empty slot (`input.files[0]` is undefined) is no file, not a malformed submit.
    const list = (Array.isArray(value) ? value : [value]).filter(
      (f) => f != null,
    );
    if (!list.every((f) => f instanceof File)) return null;
    if (list.length > 0) files[name] = list;
  }
  return { fields, files };
}

/** What the UI is told: the Run's status (`queued` while another Skill Run is active). */
export interface SkillUiStatus {
  state: Exclude<SkillRunStatus, "idle">;
  message?: string;
}

export function statusMessage(state: SkillUiStatus["state"], message?: string) {
  return message === undefined
    ? { type: "status" as const, state }
    : { type: "status" as const, state, message };
}

// A File posted from the sandboxed frame is still backed by the frame's process; uploading it
// directly fails in the browser ("Failed to fetch"), so copy its bytes into a File of our own.
async function ownCopy(f: File): Promise<File> {
  return new File([await f.arrayBuffer()], f.name, { type: f.type });
}

/** Applies the same extension allowlist as the chat and the fallback screen,
 * then uploads every file through `POST /files`. Nothing is uploaded when any
 * file is refused. Returns the Attachments keyed by the UI's file names. */
export async function uploadSkillFiles(
  apiUrl: string,
  files: Record<string, File[]>,
): Promise<Record<string, AttachmentRef[]>> {
  const all = Object.values(files).flat();
  const unsupported = all.filter((f) => !isSupportedAttachment(f.name));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported file type(s): ${unsupported.map((f) => f.name).join(", ")}. Supported: ${SUPPORTED_ATTACHMENT_EXTENSIONS.join(", ")}.`,
    );
  }
  const entries = await Promise.all(
    Object.entries(files).map(
      async ([name, list]) =>
        [
          name,
          await Promise.all(
            list.map(async (f) => uploadFile(apiUrl, await ownCopy(f))),
          ),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}
