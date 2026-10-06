"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";
import { SkillHistory } from "@/components/skills/skill-history";
import { resolveApiUrl } from "@/lib/resolve-api-url";

const DEFAULT_API_URL = "http://localhost:2024";

function History() {
  const [apiUrl] = useQueryState("apiUrl", {
    defaultValue: process.env.NEXT_PUBLIC_API_URL || "",
  });
  const [skill] = useQueryState("skill");
  const [run] = useQueryState("run");
  const resolved =
    resolveApiUrl(apiUrl, process.env.NEXT_PUBLIC_API_URL) || DEFAULT_API_URL;
  return (
    <>
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
        <SkillHistory
          apiUrl={resolved}
          skill={skill}
          runId={run ?? undefined}
        />
      ) : (
        <p className="p-6 text-sm">No Skill chosen.</p>
      )}
    </>
  );
}

export default function SkillHistoryRoute(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading…</div>}>
      <History />
    </React.Suspense>
  );
}
