import { Download } from "lucide-react";
import type { OutputRef } from "@/lib/outputs";

/** Renders the `outputs` field the thread's state carries after a run as
 * download links — `GET /files/{key}` on the same `apiUrl` the agent is
 * served from (deepagent-aegra mounts the upload/download app unprefixed at
 * the app root, see deepagent-aegra/docs/adr/0004). Nothing here parses the
 * orchestrator's chat reply for a path: the Output's `{key, filename}` is
 * the only source of truth. */
export function OutputLinks({
  outputs,
  apiUrl,
}: {
  outputs: OutputRef[] | undefined;
  apiUrl: string;
}) {
  if (!outputs || outputs.length === 0) return null;

  return (
    <div
      data-testid="output-links"
      className="bg-muted/30 mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-lg border p-3"
    >
      <span className="text-sm font-medium text-gray-700">Outputs</span>
      <ul className="flex flex-col gap-1">
        {outputs.map((output) => (
          <li key={output.key}>
            <a
              href={`${apiUrl}/files/${output.key}`}
              download={output.filename}
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <Download className="size-4" />
              {output.filename}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
