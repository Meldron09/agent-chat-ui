"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { Paperclip, Play, X } from "lucide-react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { Client, type Message } from "@langchain/langgraph-sdk";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { AttachmentsPreview } from "../thread/AttachmentsPreview";
import { OutputLinks } from "../thread/output-links";
import { WebSearchToggle } from "../thread/web-search-toggle";
import { ThreadView } from "../thread/agent-inbox";
import StreamContext from "@/providers/Stream";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { getContentString } from "../thread/utils";
import { webSearchConfigForRun } from "@/lib/web-search";
import { useFileUpload } from "@/hooks/use-file-upload";
import { toast } from "sonner";
import { SkillUiFrame } from "./skill-ui-frame";
import {
  SUPPORTED_ATTACHMENT_EXTENSIONS,
  type AttachmentRef,
} from "@/lib/attachments";
import type { OutputRef } from "@/lib/outputs";
import { uploadSkillFiles, type SkillUiSubmit } from "@/lib/skill-ui";
import {
  queuedFromEvent,
  skillRunInput,
  skillRunStatus,
  type SkillRunStatus,
} from "@/lib/skill-run";

const STATUS_LABEL: Record<SkillRunStatus, string> = {
  idle: "",
  queued: "Queued: waiting for another Skill Run to finish…",
  running: "Running…",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The screen for one Skill: its own `ui/` in a sandboxed frame, or, for a Skill
 * with none, a built-in free-text box and file picker. Either way the web search
 * switch is the host's, and submitting starts a Skill Run -- a hidden, one-shot
 * thread on the Orchestrator (deepagent-aegra ADR-0011) -- whose status, final
 * message and Outputs the result panel below shows. */
export function SkillRunScreen({
  apiUrl,
  assistantId,
  skill,
  hasUi = false,
}: {
  apiUrl: string;
  assistantId: string;
  skill: string;
  hasUi?: boolean;
}) {
  const [text, setText] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [queued, setQueued] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [run, setRun] = useState<{ threadId: string; runId: string }>();
  const [cancelled, setCancelled] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const submitting = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const { attachments, handleFileUpload, removeAttachment, uploading } =
    useFileUpload({ apiUrl });

  const client = useMemo(() => new Client({ apiUrl }), [apiUrl]);

  // Bound to the Run's own thread, not the URL's `threadId` query param the chat uses.
  const stream = useStream<{ messages: Message[]; outputs?: OutputRef[] }>({
    apiUrl,
    client,
    assistantId,
    threadId,
    onThreadId: setThreadId,
    onCreated: ({ thread_id, run_id }) =>
      setRun({ threadId: thread_id, runId: run_id }),
    onFinish: () => setFinished(true),
    onCustomEvent: (event) => setQueued((q) => queuedFromEvent(event) ?? q),
    fetchStateHistory: true,
  });

  // A Run that needs an approval ends its stream and waits in its checkpoint; the existing
  // approval view resumes it through a `useStreamContext()` we give it, bound to this Run's thread.
  const approval =
    started &&
    !cancelled &&
    !stream.isLoading &&
    isAgentInboxInterruptSchema(stream.interrupt)
      ? stream.interrupt
      : undefined;
  const approvalStream = {
    ...stream,
    apiUrl,
    submit: ((...args: Parameters<typeof stream.submit>) => {
      setFinished(false); // resumed: not done until it finishes again
      const [values, options] = args;
      // The resume repeats what the first submit set that the thread does not keep: resumable
      // (leaving the page must not cancel the Run) and the person's web search choice.
      return stream.submit(values, {
        streamMode: ["values"],
        streamResumable: true,
        config: webSearchConfigForRun(enableWebSearch),
        ...options,
      });
    }) as typeof stream.submit,
  } as unknown as ComponentProps<typeof StreamContext.Provider>["value"];

  const status = skillRunStatus({
    isLoading: stream.isLoading,
    error: stream.error,
    started,
    finished,
    queued,
    cancelled,
    interrupted: !!approval,
  });
  const finalMessage = [...stream.messages]
    .reverse()
    .find((m) => m.type === "ai" && getContentString(m.content).trim());

  // Stopping the stream only disconnects (the Run is resumable, so the server keeps
  // going); the server-side cancel is what ends a running Run or drops a queued one.
  const cancel = async () => {
    if (!run) return;
    setCancelling(true);
    try {
      await client.runs.cancel(run.threadId, run.runId);
    } catch (e) {
      toast.error(
        `Could not cancel: ${e instanceof Error ? e.message : String(e)}`,
      );
      setCancelling(false);
      return;
    }
    setCancelled(true);
    stream.stop();
  };

  const start = (
    fields: Record<string, unknown>,
    files: Record<string, AttachmentRef[]>,
  ) => {
    const { input, options } = skillRunInput({
      skill,
      fields,
      files,
      enableWebSearch,
    });
    setStarted(true);
    // Resumable, like the chat: leaving this page must not cancel the Run.
    stream.submit(input, {
      ...options,
      streamMode: ["values"],
      streamResumable: true,
    });
  };

  // The UI's `submit`: the host uploads and validates the files, then starts the
  // Run exactly as the fallback screen does.
  const submitFromUi = useCallback(
    async ({ fields, files }: SkillUiSubmit) => {
      if (submitting.current) return;
      submitting.current = true;
      setUploadError(undefined);
      try {
        start(fields, await uploadSkillFiles(apiUrl, files));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setUploadError(message);
        toast.error(message);
        submitting.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `start` reads the latest web search choice
    [apiUrl, skill, enableWebSearch],
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">{skill}</h1>
      {hasUi && (
        <>
          <SkillUiFrame
            apiUrl={apiUrl}
            skill={skill}
            onSubmit={submitFromUi}
            status={
              uploadError
                ? { state: "failed", message: uploadError }
                : status === "idle"
                  ? undefined
                  : { state: status }
            }
          />
          {!started && (
            <WebSearchToggle
              checked={enableWebSearch}
              onCheckedChange={setEnableWebSearch}
            />
          )}
        </>
      )}
      {!hasUi && !started && (
        <div className="flex flex-col gap-3">
          <Textarea
            aria-label="Input"
            placeholder="Describe what you want this Skill to do"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <AttachmentsPreview
            attachments={attachments}
            onRemove={removeAttachment}
            className="p-0"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => picker.current?.click()}
              >
                <Paperclip className="size-4" />
                {uploading ? "Uploading…" : "Add files"}
              </Button>
              <input
                ref={picker}
                type="file"
                multiple
                aria-label="Files"
                accept={SUPPORTED_ATTACHMENT_EXTENSIONS.join(",")}
                className="hidden"
                onChange={handleFileUpload}
              />
              <WebSearchToggle
                checked={enableWebSearch}
                onCheckedChange={setEnableWebSearch}
              />
            </div>
            <Button
              variant="brand"
              disabled={uploading}
              onClick={() => start({ text }, { files: attachments })}
            >
              <Play className="size-4" />
              Run
            </Button>
          </div>
        </div>
      )}
      {started && (
        <div
          data-testid="skill-run-result"
          className="flex flex-col gap-3"
        >
          <div
            role="status"
            className="text-sm font-medium"
          >
            {approval ? "Waiting for your approval…" : STATUS_LABEL[status]}
          </div>
          {approval && (
            <StreamContext.Provider value={approvalStream}>
              <ThreadView interrupt={approval} />
            </StreamContext.Provider>
          )}
          {run &&
            !approval &&
            (status === "queued" || status === "running") && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={cancelling}
                onClick={cancel}
              >
                <X className="size-4" />
                Cancel
              </Button>
            )}
          {status === "failed" && (
            <div
              role="alert"
              className="text-sm text-red-600"
            >
              {stream.error instanceof Error
                ? stream.error.message
                : String(stream.error)}
            </div>
          )}
          {finalMessage && (
            <div className="bg-muted/30 rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {getContentString(finalMessage.content)}
            </div>
          )}
          <OutputLinks
            outputs={stream.values.outputs}
            apiUrl={apiUrl}
          />
        </div>
      )}
    </div>
  );
}
