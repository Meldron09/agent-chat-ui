"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";
import { SkillRunScreen } from "@/components/skills/skill-run-screen";
import { Toaster } from "@/components/ui/sonner";
import { resolveApiUrl } from "@/lib/resolve-api-url";

const DEFAULT_API_URL = "http://localhost:2024";
const DEFAULT_ASSISTANT_ID = "agent";

function Run() {
  const [apiUrl] = useQueryState("apiUrl", {
    defaultValue: process.env.NEXT_PUBLIC_API_URL || "",
  });
  const [assistantId] = useQueryState("assistantId", {
    defaultValue: process.env.NEXT_PUBLIC_ASSISTANT_ID || "",
  });
  const [skill] = useQueryState("skill");
  const resolved =
    resolveApiUrl(apiUrl, process.env.NEXT_PUBLIC_API_URL) || DEFAULT_API_URL;
  return (
    <>
      <Toaster />
      <div className="p-2">
        <Link
          href={`/skills?apiUrl=${encodeURIComponent(resolved)}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to Skills
        </Link>
      </div>
      {skill ? (
        <SkillRunScreen
          // A different Skill is a fresh screen, not the previous Run's state.
          key={skill}
          apiUrl={resolved}
          assistantId={assistantId || DEFAULT_ASSISTANT_ID}
          skill={skill}
        />
      ) : (
        <p className="p-6 text-sm">No Skill chosen.</p>
      )}
    </>
  );
}

export default function SkillRunRoute(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading…</div>}>
      <Run />
    </React.Suspense>
  );
}
