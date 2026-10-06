"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  deleteSkill,
  installSkill,
  listSkills,
  replaceSkill,
  type Skill,
} from "@/lib/skills";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The Skill Library: every installed Skill, and a zip upload to add one. */
export function SkillsPage({ apiUrl }: { apiUrl: string }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [installError, setInstallError] = useState<string>();
  const [installing, setInstalling] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () => listSkills(apiUrl).then(setSkills, (e) => setLoadError(message(e))),
    [apiUrl],
  );
  useEffect(() => {
    load();
  }, [load]);

  /** Runs a change to the library, then re-lists; a refusal shows as the page error. */
  const change = async (action: () => Promise<unknown>) => {
    setInstallError(undefined);
    setInstalling(true);
    try {
      await action();
    } catch (e) {
      setInstallError(message(e));
    } finally {
      await load(); // also after a refusal: the list may be stale (e.g. already deleted)
      setInstalling(false);
    }
  };
  const install = (zip: File) => change(() => installSkill(apiUrl, zip));

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
            <SkillRow
              key={s.name}
              skill={s}
              busy={installing}
              onReplace={(zip) =>
                change(() => replaceSkill(apiUrl, s.name, zip))
              }
              onDelete={() => setDeleting(s.name)}
            />
          ))}
        </ul>
      )}
      <Dialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Delete {deleting}?</DialogTitle>
            <DialogDescription>
              This removes the Skill from the library. It can be installed again
              from a zip.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleting(undefined)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const name = deleting!;
                setDeleting(undefined);
                change(() => deleteSkill(apiUrl, name));
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillRow({
  skill,
  busy,
  onReplace,
  onDelete,
}: {
  skill: Skill;
  busy: boolean;
  onReplace: (zip: File) => void;
  onDelete: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div>
        <div className="font-medium">{skill.name}</div>
        <div className="text-muted-foreground text-sm">{skill.description}</div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <RefreshCw className="size-4" />
          Replace
        </Button>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          aria-label={`Replace ${skill.name} with a zip`}
          className="hidden"
          onChange={(e) => {
            const zip = e.target.files?.[0];
            e.target.value = "";
            if (zip) onReplace(zip);
          }}
        />
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={busy}
          aria-label={`Delete ${skill.name}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
