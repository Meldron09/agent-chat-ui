"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, Play } from "lucide-react";
import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { AttachmentsPreview } from "../thread/AttachmentsPreview";
import { OutputLinks } from "../thread/output-links";
import { WebSearchToggle } from "../thread/web-search-toggle";
import { getContentString } from "../thread/utils";
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
  const [uploadError, setUploadError] = useState<string>();
  const submitting = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const { attachments, handleFileUpload, removeAttachment, uploading } =
    useFileUpload({ apiUrl });

  // Bound to the Run's own thread, not the URL's `threadId` query param the chat uses.
  const stream = useStream<{ messages: Message[]; outputs?: OutputRef[] }>({
    apiUrl,
    assistantId,
    threadId,
    onThreadId: setThreadId,
    onFinish: () => setFinished(true),
    onCustomEvent: (event) => setQueued((q) => queuedFromEvent(event) ?? q),
    fetchStateHistory: true,
  });

  const status = skillRunStatus({
    isLoading: stream.isLoading,
    error: stream.error,
    started,
    finished,
    queued,
  });
  const finalMessage = [...stream.messages]
    .reverse()
    .find((m) => m.type === "ai" && getContentString(m.content).trim());

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
            {STATUS_LABEL[status]}
          </div>
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
