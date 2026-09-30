"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { McpTab } from "./mcp-tab";

/** Header gear + the Settings dialog it opens. MCP is the only tab for now;
 * @radix-ui/react-tabs isn't installed, so the strip is a plain button. */
export function SettingsButton({ apiUrl }: { apiUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Settings"
        onClick={() => setOpen(true)}
      >
        <Settings className="size-5" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className="sr-only">
              App settings
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 border-b">
            <button className="border-b-2 border-black px-1 pb-2 text-sm font-medium">
              MCP
            </button>
          </div>
          <McpTab apiUrl={apiUrl} />
        </DialogContent>
      </Dialog>
    </>
  );
}
