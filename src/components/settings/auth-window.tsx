"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PasswordInput } from "../ui/password-input";
import {
  connectMcp,
  type ConnectResult,
  type McpServer,
} from "@/lib/mcp-connections";

type State =
  | { s: "idle" }
  | { s: "pending" }
  | { s: "error"; message: string }
  | { s: "done"; result: ConnectResult };

/** Stacked modal over Settings: a Credential Form rendered from the server's
 * `credentialFields`, then the Connect result. The API's `{"error"}` message
 * is shown verbatim. Secrets live only in this component's state and are
 * dropped with the form on success. */
export function AuthWindow({
  apiUrl,
  server,
  onClose,
  onConnected,
}: {
  apiUrl: string;
  server: McpServer;
  onClose: () => void;
  onConnected: () => void;
}) {
  const fields = server.credentialFields;
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<State>({ s: "idle" });
  const pending = state.s === "pending";
  const filled = (name: string) => (values[name] ?? "").trim() !== "";

  const submit = async () => {
    setState({ s: "pending" });
    try {
      const credentials = Object.fromEntries(
        fields
          .filter((f) => filled(f.name))
          .map((f) => [f.name, values[f.name].trim()]),
      );
      const result = await connectMcp(apiUrl, server.server, credentials);
      setValues({});
      setState({ s: "done", result });
      onConnected();
    } catch (e) {
      // Secrets must not linger in the DOM after a submit; the rest can be fixed and retried.
      setValues((v) =>
        Object.fromEntries(
          fields
            .filter((f) => !f.isSecret)
            .map((f) => [f.name, v[f.name] ?? ""]),
        ),
      );
      setState({
        s: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {server.title}</DialogTitle>
          <DialogDescription>
            Credentials are stored on your server and used for every run while
            this connection is on.
          </DialogDescription>
        </DialogHeader>
        {state.s === "done" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-green-800">
              <Check className="mt-0.5 size-4" />
              <div className="text-sm font-medium">
                Connected as @{state.result.login}
                <div className="text-xs font-normal">
                  Scopes: {state.result.scopes.join(", ") || "none"} ·{" "}
                  {state.result.toolCount} tools available
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="brand"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <fieldset
              disabled={pending}
              className="space-y-4"
            >
              {fields.map((f) => {
                const Comp = f.isSecret ? PasswordInput : Input;
                return (
                  <div
                    key={f.name}
                    className="space-y-1.5"
                  >
                    <Label htmlFor={f.name}>
                      {f.name}
                      {!f.isRequired && (
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      )}
                    </Label>
                    <Comp
                      id={f.name}
                      autoComplete="off"
                      spellCheck={false}
                      value={values[f.name] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.name]: e.target.value })
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      {f.description}
                    </p>
                  </div>
                );
              })}
            </fieldset>
            {state.s === "error" && (
              <p className="text-sm text-red-600">{state.message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={
                  pending || fields.some((f) => f.isRequired && !filled(f.name))
                }
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
