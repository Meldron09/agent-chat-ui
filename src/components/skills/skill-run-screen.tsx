"use client";

import { useRef, useState } from "react";
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
import { SUPPORTED_ATTACHMENT_EXTENSIONS } from "@/lib/attachments";
import type { OutputRef } from "@/lib/outputs";
import { skillRunInput, skillRunStatus } from "@/lib/skill-run";

const STATUS_LABEL = {
  idle: "",
  running: "Running…",
  done: "Done",
  failed: "Failed",
};

/** The built-in screen for a Skill that has no `ui/`: a free-text box, a file
 * picker and the web search switch. Submitting starts a Skill Run -- a hidden,
 * one-shot thread on the Orchestrator (deepagent-aegra ADR-0011) -- and the
 * result panel below shows its status, final message and Outputs. */
export function SkillRunScreen({
  apiUrl,
  assistantId,
  skill,
}: {
  apiUrl: string;
  assistantId: string;
  skill: string;
}) {
  const [text, setText] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [started, setStarted] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { attachments, handleFileUpload, removeAttachment, uploading } =
    useFileUpload({ apiUrl });

  // Bound to the Run's own thread, not the URL's `threadId` query param the chat uses.
  const stream = useStream<{ messages: Message[]; outputs?: OutputRef[] }>({
    apiUrl,
    assistantId,
    threadId,
    onThreadId: setThreadId,
    fetchStateHistory: true,
  });

  const status = skillRunStatus({
    isLoading: stream.isLoading,
    error: stream.error,
    started,
  });
  const finalMessage = [...stream.messages]
    .reverse()
    .find((m) => m.type === "ai" && getContentString(m.content).trim());

  const start = () => {
    const { input, options } = skillRunInput({
      skill,
      text: text.trim(),
      files: attachments,
      enableWebSearch,
    });
    setStarted(true);
    stream.submit(input, { ...options, streamMode: ["values"] });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">{skill}</h1>
      {!started && (
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
              onClick={start}
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
