import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `@testing-library/react`'s own auto-cleanup only self-registers when it
// finds a global `afterEach` (i.e. under `test.globals: true`), which this
// project's vitest.config.ts does not set — `describe`/`it`/`expect` are all
// imported explicitly instead. Without this, DOM from one test's `render()`
// leaks into the next: harmless for tests asserting distinct content, but a
// real problem once two tests in the same file render the same accessible
// name (e.g. two renders of the same toggle) and later `getByRole` calls
// stop resolving to the element the current test actually rendered.
afterEach(() => {
  cleanup();
});
