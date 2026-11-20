import { act } from "react";
import { createRoot } from "react-dom/client";

import { session } from "./fixture";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

const pending = new Map<number, (answer: Response) => void>();
let reads = 0;

function report(id: string, value: string): void {
  document.getElementById(id)?.replaceChildren(value);
}

globalThis.fetch = () =>
  new Promise<Response>((resolve) => {
    pending.set(++reads, resolve);
    report("reads", String(reads));
    report("pending", [...pending.keys()].join(","));
  });

async function answer(
  read: number,
  connected: boolean,
  csrfToken: string,
): Promise<void> {
  await act(async () => {
    const resolve = pending.get(read);
    if (!resolve) throw new Error(`Session read ${read} is not pending`);
    pending.delete(read);
    report("pending", [...pending.keys()].join(","));
    resolve(
      new Response(JSON.stringify(session(connected, csrfToken)), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  report("completed", String(read));
}

async function mount(): Promise<void> {
  // The API client takes this probe's held fetch when its module first loads.
  const { mutationHeaders } = await import("../../api/client");
  const { SessionProvider, useSession } = await import("../../session/context");

  function Probe() {
    const { state } = useSession();
    return (
      <>
        <output aria-label="Session status">{state.status}</output>
        <output aria-label="GitHub connection">
          {state.status === "signed-in"
            ? state.session.user.githubConnected
              ? "connected"
              : "not connected"
            : ""}
        </output>
        <output aria-label="CSRF token">
          {mutationHeaders()["X-CSRF-Token"]}
        </output>
        <output id="reads" aria-label="Session reads" />
        <output id="pending" aria-label="Unanswered reads" />
        <output id="completed" aria-label="Completed read" />
        <button onClick={() => window.dispatchEvent(new Event("focus"))}>
          Focus window
        </button>
        <button onClick={() => void answer(1, false, "startup-csrf")}>
          Answer startup
        </button>
        <button onClick={() => void answer(3, true, "new-csrf")}>
          Answer newer focus
        </button>
        <button onClick={() => void answer(2, false, "old-csrf")}>
          Answer older focus
        </button>
      </>
    );
  }

  const container = document.getElementById("session-probe");
  if (!container) throw new Error("The session test container is missing");
  await act(async () => {
    createRoot(container).render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
  });
}

void mount();
