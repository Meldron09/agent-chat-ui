"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { installSkill, listSkills, type Skill } from "@/lib/skills";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The Skill Library: every installed Skill, and a zip upload to add one. */
export function SkillsPage({ apiUrl }: { apiUrl: string }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [installError, setInstallError] = useState<string>();
  const [installing, setInstalling] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () => listSkills(apiUrl).then(setSkills, (e) => setLoadError(message(e))),
    [apiUrl],
  );
  useEffect(() => {
    load();
  }, [load]);

  const install = async (zip: File) => {
    setInstallError(undefined);
    setInstalling(true);
    try {
      await installSkill(apiUrl, zip);
      await load();
    } catch (e) {
      setInstallError(message(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Skills</h1>
        <Button
          variant="brand"
          disabled={installing}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" />
          {installing ? "Installing…" : "Install a Skill"}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          aria-label="Skill zip"
          className="hidden"
          onChange={(e) => {
            const zip = e.target.files?.[0];
            e.target.value = ""; // lets the same file be picked again after a fix
            if (zip) install(zip);
          }}
        />
      </div>
      {installError && (
        <div
          role="alert"
          className="text-sm text-red-600"
        >
          {installError}
        </div>
      )}
      {loadError && <div className="text-sm text-red-600">{loadError}</div>}
      {skills && skills.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No Skills installed yet. Upload a Skill as a zip to add one.
        </p>
      )}
      {skills && skills.length > 0 && (
        <ul className="divide-y rounded-md border">
          {skills.map((s) => (
            <li
              key={s.name}
              className="p-3"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-muted-foreground text-sm">
                {s.description}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
