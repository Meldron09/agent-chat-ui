"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";
import { SkillsPage } from "@/components/skills/skills-page";
import { resolveApiUrl } from "@/lib/resolve-api-url";

const DEFAULT_API_URL = "http://localhost:2024";

function Skills() {
  const [apiUrl] = useQueryState("apiUrl", {
    defaultValue: process.env.NEXT_PUBLIC_API_URL || "",
  });
  const resolved =
    resolveApiUrl(apiUrl, process.env.NEXT_PUBLIC_API_URL) || DEFAULT_API_URL;
  return (
    <>
      <div className="p-2">
        <Link
          href={apiUrl ? `/?apiUrl=${encodeURIComponent(apiUrl)}` : "/"}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to chat
        </Link>
      </div>
      <SkillsPage apiUrl={resolved} />
    </>
  );
}

export default function SkillsRoute(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading…</div>}>
      <Skills />
    </React.Suspense>
  );
}
