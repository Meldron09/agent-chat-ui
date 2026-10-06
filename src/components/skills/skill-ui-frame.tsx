"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  parseSubmit,
  statusMessage,
  type SkillUiStatus,
  type SkillUiSubmit,
} from "@/lib/skill-ui";

/** A Skill's own screen: its `ui/` bundle in a sandboxed iframe (deepagent-aegra
 * ADR-0010). `sandbox="allow-scripts"` and never `allow-same-origin`, so the
 * bundle gets an opaque origin: no cookies, no storage, no access to this page
 * (the backend's CSP also blocks its network). It can only post `submit`; the host
 * answers with `status` events. A sandboxed frame's messages arrive with origin
 * "null", so the frame is identified by `event.source`, not by origin. */
export function SkillUiFrame({
  apiUrl,
  skill,
  status,
  onSubmit,
}: {
  apiUrl: string;
  skill: string;
  status?: SkillUiStatus;
  onSubmit: (submit: SkillUiSubmit) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const submit = parseSubmit(event.data);
      if (submit) onSubmit(submit);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSubmit]);

  const sendStatus = useCallback(() => {
    if (!status) return;
    // "*": the frame's origin is opaque, there is no origin to target.
    frame.current?.contentWindow?.postMessage(
      statusMessage(status.state, status.message),
      "*",
    );
  }, [status]);
  useEffect(sendStatus, [sendStatus]);

  return (
    <iframe
      ref={frame}
      title={`${skill} screen`}
      sandbox="allow-scripts"
      src={`${apiUrl}/skills/${encodeURIComponent(skill)}/ui/index.html`}
      onLoad={sendStatus}
      className="h-[28rem] w-full rounded-lg border"
    />
  );
}
