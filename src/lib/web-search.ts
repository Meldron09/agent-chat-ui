/** The per-run `configurable` shape `stream.submit`'s `config` option
 * carries for deepagent-aegra's `WebSearchGateMiddleware`
 * (deepagent-aegra/agent/web_search_gate.py, ADR-0007) — a per-run toggle,
 * not a deployment setting, set fresh on every submission from the
 * composer's Web Search switch rather than baked into the assistant/graph
 * config once. */
export interface WebSearchConfigurable {
  enable_web_search: boolean;
  // Index signature so this satisfies `useStream`'s `ConfigWithConfigurable`
  // (its `configurable` requires one), the same way `Record<string, unknown>`
  // does for its own default type parameter.
  [key: string]: unknown;
}

export function webSearchConfigForRun(enableWebSearch: boolean): {
  configurable: WebSearchConfigurable;
} {
  return { configurable: { enable_web_search: enableWebSearch } };
}
