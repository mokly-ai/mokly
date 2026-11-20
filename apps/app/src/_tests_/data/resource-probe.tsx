import { useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { ApiError } from "../../api/errors";
import {
  ResourceInvalidationProvider,
  useInvalidateResources,
} from "../../data/resource-invalidation";
import { useResource } from "../../data/use-resource";

const pending: { resolve: () => void; reject: () => void }[] = [];
const requests: string[] = [];
const frames: string[] = [];

function report(id: string, value: string): void {
  document.getElementById(id)?.replaceChildren(value);
}

function read(key: string): Promise<string> {
  requests.push(key);
  report("requests", requests.join(","));
  return new Promise((resolve, reject) => {
    pending.push({
      resolve: () => resolve(key),
      reject: () =>
        reject(
          new ApiError({
            code: "unavailable",
            reason: "operation-unavailable",
            message: "The probe read failed.",
            requestId: "probe-request",
            status: 503,
          }),
        ),
    });
  });
}

function Probe() {
  const [key, setKey] = useState("one");
  const [enabled, setEnabled] = useState(true);
  const [reuse, setReuse] = useState(false);
  const invalidate = useInvalidateResources();
  const resource = useResource(
    () => read(key),
    key,
    enabled,
    ["probe"],
    reuse ? { reloadOnEnable: false } : {},
  );
  useLayoutEffect(() => {
    frames.push(
      [
        key,
        resource.state.status,
        ...(resource.state.status === "ready" ? [resource.state.value] : []),
      ].join(":"),
    );
    report("frames", frames.join("\n"));
  });
  // This effect follows the hook's read effect. Tests wait for this signal
  // before checking that re-enable did or did not start another read.
  useEffect(() => {
    report("committed", `${key}:${enabled}:${reuse}`);
  });
  return (
    <>
      <output aria-label="Resource status">
        {resource.state.status}
        {resource.state.status === "ready" && resource.state.refreshing
          ? " refreshing"
          : ""}
      </output>
      <output aria-label="Resource value">
        {resource.state.status === "ready" ? resource.state.value : ""}
      </output>
      <output aria-label="Resource error">
        {resource.state.status === "error" ? resource.state.error.reason : ""}
      </output>
      <output id="requests" aria-label="Requests" />
      <output id="frames" aria-label="Committed frames" />
      <output id="committed" aria-label="Effects committed" />
      <button onClick={() => pending.shift()?.resolve()}>Resolve read</button>
      <button onClick={() => pending.shift()?.reject()}>Fail read</button>
      <button onClick={() => setKey("two")}>Switch key</button>
      <button onClick={() => setKey("one")}>Return to first key</button>
      <button onClick={() => setEnabled((value) => !value)}>
        Toggle enabled
      </button>
      <button onClick={() => setReuse(true)}>Reuse settled state</button>
      <button onClick={resource.reload}>Reload</button>
      <button onClick={() => invalidate(["probe"])}>Invalidate</button>
      <button onClick={() => resource.set("manual")}>Set disabled state</button>
    </>
  );
}

const container = document.getElementById("resource-probe");
if (!container) throw new Error("The resource test container is missing");
createRoot(container).render(
  <ResourceInvalidationProvider>
    <Probe />
  </ResourceInvalidationProvider>,
);
