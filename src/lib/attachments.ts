/** A file the person uploaded this run -- the same `{key, filename}` pointer
 * shape as an Output (deepagent-aegra/CONTEXT.md, ADR-0001), carried in the
 * run's `attachments` input, not embedded as inline base64 chat content. */
export interface AttachmentRef {
  key: string;
  filename: string;
}

/** The extensions `deepagent-aegra`'s `file-reader` subagent actually
 * dispatches on (deepagent-aegra/agent/file_reader.py's SYSTEM_PROMPT:
 * read_pdf .pdf, read_xlsx .xlsx/.xls, read_docx .docx, read_pptx .pptx,
 * read_txt .txt/.md). Client-side, this only decides whether a selected
 * file is worth uploading at all -- the server dispatches on the same
 * filename extension once the Attachment reaches `file-reader`.
 *
 * Deliberately drops the old image allowlist (jpeg/png/gif/webp) rather
 * than keeping it alongside these seven: `file-reader` has no tool for any
 * image format, so an uploaded image would always dead-end as "unsupported"
 * server-side -- offering the upload button for a type that can never
 * succeed is worse than not offering it. There is currently no vision path
 * in this deployment; an uploaded image was never usable as anything but
 * inline chat content, which this rewrite removes in favor of the
 * `{key, filename}` pointer contract every attachment now uses. */
export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".pptx",
  ".txt",
  ".md",
];

export function isSupportedAttachment(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** What `stream.submit`'s `attachments` run-input field should carry for a
 * given selection -- `undefined` (omitted entirely) when nothing is
 * attached, never an empty array, mirroring how `context` is only ever
 * included when non-empty (src/components/thread/index.tsx). */
export function attachmentsForRun(
  attachments: AttachmentRef[],
): AttachmentRef[] | undefined {
  return attachments.length > 0 ? attachments : undefined;
}
