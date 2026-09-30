import assert from "node:assert/strict";

/** Assert the shared request boundary applied to every upload exchange step. */
export function assertUploadRequest(
  init: RequestInit | undefined,
  method: "POST" | "PUT",
  token: string,
): Headers {
  assert.equal(init?.method, method);
  assert.equal(init?.redirect, "manual");
  assert.ok(init?.signal, `${method} request must carry an AbortSignal`);
  const headers = new Headers(init.headers);
  assert.equal(headers.get("Authorization"), `Bearer ${token}`);
  return headers;
}
