import { File, X as XIcon } from "lucide-react";
import type { AttachmentRef } from "@/lib/attachments";
import { cn } from "@/lib/utils";

/** Renders the files staged for the next message as removable chips --
 * `{key, filename}` pointers already uploaded via `POST /files`, not inline
 * file content (there is no base64 data left to preview). */
export function AttachmentsPreview({
  attachments,
  onRemove,
  className,
}: {
  attachments: AttachmentRef[];
  onRemove: (idx: number) => void;
  className?: string;
}) {
  if (!attachments.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 p-3.5 pb-0", className)}>
      {attachments.map((attachment, idx) => (
        <div
          key={`${attachment.key}-${idx}`}
          className="relative flex items-center gap-2 rounded-md border bg-gray-100 px-3 py-2"
        >
          <File className="h-5 w-5 flex-shrink-0 text-teal-700" />
          <span className="max-w-48 truncate text-sm text-gray-800">
            {attachment.filename}
          </span>
          <button
            type="button"
            className="ml-1 self-start rounded-full bg-gray-200 p-1 text-teal-700 hover:bg-gray-300"
            onClick={() => onRemove(idx)}
            aria-label={`Remove ${attachment.filename}`}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
