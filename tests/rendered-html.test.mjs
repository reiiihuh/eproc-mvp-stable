import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const request = new Request("http://localhost/", {
      headers: { accept: "text/html" },
    });
  const environment = {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    };
  const executionContext = {
      waitUntil() {},
      passThroughOnException() {},
    };
  // Vinext releases have exported either a Worker object or the fetch handler
  // itself. Exercise both supported build shapes.
  const response = await (typeof worker === "function"
    ? worker(request, environment, executionContext)
    : worker.fetch(request, environment, executionContext));

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});
