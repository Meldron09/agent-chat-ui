"use client";

import { useCallback, useEffect, useState } from "react";
import { GitHubSVG } from "../icons/github";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { AuthWindow } from "./auth-window";
import {
  disconnectMcp,
  listMcpServers,
  setMcpEnabled,
  type McpServer,
} from "@/lib/mcp-connections";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Static logo per curated server, keyed by `server`; unknown slugs get an initial. */
function Logo({ server }: { server: McpServer }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-white p-1.5 text-xs font-semibold">
      {server.server === "github" ? <GitHubSVG /> : server.title[0]}
    </span>
  );
}

function Row({
  server,
  error,
  onToggle,
  onConnect,
  onDisconnect,
}: {
  server: McpServer;
  error?: string;
  onToggle: (enabled: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { connection } = server;
  const problem = connection?.lastError ?? error;
  return (
    <li className="flex items-center gap-3 p-3">
      <Logo server={server} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{server.title}</div>
        <div className="text-muted-foreground text-xs">
          {!connection
            ? "Not connected"
            : connection.lastError
              ? `Connection error (${connection.login})`
              : `Connected as ${connection.login}`}
        </div>
        {problem && <div className="text-xs text-red-600">{problem}</div>}
      </div>
      {connection && (
        <Switch
          aria-label={`${server.title} enabled`}
          checked={connection.enabled}
          onCheckedChange={onToggle}
        />
      )}
      {connection?.lastError && (
        <Button
          size="sm"
          variant="brand"
          onClick={onConnect}
        >
          Reconnect
        </Button>
      )}
      {connection ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      ) : (
        <Button
          size="sm"
          variant="brand"
          onClick={onConnect}
        >
          Connect
        </Button>
      )}
    </li>
  );
}

export function McpTab({ apiUrl }: { apiUrl: string }) {
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [loadError, setLoadError] = useState<string>();
  // Action failures (toggle rollback, disconnect) shown on the row they came from.
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [authFor, setAuthFor] = useState<string>();

  const load = useCallback(
    () =>
      listMcpServers(apiUrl).then(setServers, (e) => setLoadError(message(e))),
    [apiUrl],
  );
  useEffect(() => {
    load();
  }, [load]);
  const update = (slug: string, fn: (s: McpServer) => McpServer) =>
    setServers((all) => all && all.map((s) => (s.server === slug ? fn(s) : s)));
  const setRowError = (slug: string, error?: string) =>
    setRowErrors((all) => ({ ...all, [slug]: error ?? "" }));
  // A failed refresh must not replace the tab (and unmount the open auth window).
  const refresh = (slug: string) =>
    listMcpServers(apiUrl).then(setServers, (e) =>
      setRowError(slug, message(e)),
    );

  const withEnabled = (enabled: boolean) => (s: McpServer) =>
    s.connection ? { ...s, connection: { ...s.connection, enabled } } : s;

  const toggle = async (slug: string, enabled: boolean) => {
    setRowError(slug);
    update(slug, withEnabled(enabled));
    try {
      await setMcpEnabled(apiUrl, slug, enabled);
    } catch (e) {
      update(slug, withEnabled(!enabled));
      setRowError(slug, message(e));
    }
  };

  const disconnect = async (slug: string) => {
    setRowError(slug);
    try {
      await disconnectMcp(apiUrl, slug);
      update(slug, (s) => ({ ...s, connection: null }));
    } catch (e) {
      setRowError(slug, message(e));
    }
  };

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!servers)
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  const authServer = servers.find((s) => s.server === authFor);
  return (
    <>
      <ul className="divide-y rounded-lg border">
        {servers.map((s) => (
          <Row
            key={s.server}
            server={s}
            error={rowErrors[s.server]}
            onToggle={(enabled) => toggle(s.server, enabled)}
            onConnect={() => setAuthFor(s.server)}
            onDisconnect={() => disconnect(s.server)}
          />
        ))}
      </ul>
      {authServer && (
        <AuthWindow
          apiUrl={apiUrl}
          server={authServer}
          onClose={() => setAuthFor(undefined)}
          onConnected={() => refresh(authServer.server)}
        />
      )}
    </>
  );
}
