"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OutputLinks } from "../thread/output-links";
import {
  getSkillRun,
  historyHref,
  listSkillRuns,
  type SkillRunRecord,
} from "@/lib/skill-runs";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const STATUS_LABEL: Record<SkillRunRecord["status"], string> = {
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

const when = (iso: string) => new Date(iso).toLocaleString();

/** The Skill's own state, when it is no longer what the Run used (no snapshot is kept). */
function SkillStateBadge({ state }: { state: SkillRunRecord["skillState"] }) {
  if (!state) return null;
  return (
    <span className="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">
      {state}
    </span>
  );
}

/** A Skill's past Runs (the last 50), or, given `runId`, one Run: what was submitted, the
 * final message and the Outputs. Read from the backend's recorded history, so it works
 * for a Skill that has since been deleted or replaced. */
export function SkillHistory({
  apiUrl,
  skill,
  runId,
}: {
  apiUrl: string;
  skill: string;
  runId?: string;
}) {
  const [loaded, setLoaded] = useState<{
    key: string;
    result: SkillRunRecord[] | SkillRunRecord | string;
  }>();
  const key = `${skill}/${runId ?? ""}`;
  useEffect(() => {
    const load = runId
      ? getSkillRun(apiUrl, runId)
      : listSkillRuns(apiUrl, skill);
    load.then(
      (result) => setLoaded({ key, result }),
      (e) => setLoaded({ key, result: message(e) }),
    );
  }, [apiUrl, skill, runId, key]);
  const result = loaded?.key === key ? loaded.result : undefined;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">
        {skill}: {runId ? "Run" : "Run history"}
      </h1>
      {runId && (
        <Link
          href={historyHref(apiUrl, skill)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          All Runs of {skill}
        </Link>
      )}
      {result === undefined && <p className="text-sm">Loading…</p>}
      {typeof result === "string" && (
        <p
          role="alert"
          className="text-sm text-red-600"
        >
          {result}
        </p>
      )}
      {Array.isArray(result) &&
        (result.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Runs yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {result.map((run) => (
              <li key={run.id}>
                <Link
                  href={historyHref(apiUrl, skill, run.id)}
                  className="hover:bg-muted/30 flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <span>{when(run.startedAt)}</span>
                  <span className="flex items-center gap-2">
                    <SkillStateBadge state={run.skillState} />
                    {STATUS_LABEL[run.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      {result && typeof result === "object" && !Array.isArray(result) && (
        <RunDetail
          run={result}
          apiUrl={apiUrl}
        />
      )}
    </div>
  );
}

function RunDetail({ run, apiUrl }: { run: SkillRunRecord; apiUrl: string }) {
  const uploads = Object.entries(run.files).flatMap(([field, list]) =>
    list.map((a) => ({ field, ...a })),
  );
  return (
    <div
      data-testid="skill-run-detail"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{STATUS_LABEL[run.status]}</span>
        <span className="text-muted-foreground">{when(run.startedAt)}</span>
        <SkillStateBadge state={run.skillState} />
      </div>
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Submitted</h2>
        <pre className="bg-muted/30 overflow-x-auto rounded-lg border p-3 text-xs">
          {JSON.stringify(run.fields, null, 2)}
        </pre>
        {uploads.length > 0 && (
          <ul className="text-sm">
            {uploads.map((a) => (
              <li key={`${a.field}/${a.key}`}>
                {a.field}: {a.filename}
              </li>
            ))}
          </ul>
        )}
      </section>
      {run.finalMessage && (
        <div className="bg-muted/30 rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {run.finalMessage}
        </div>
      )}
      <OutputLinks
        outputs={run.outputs}
        apiUrl={apiUrl}
      />
    </div>
  );
}
