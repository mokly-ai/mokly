import type { InteractiveBootstrap } from "../types.js";

const MESSAGE_LIMIT = 2048;

/** Bounded browser failure sent to the generation-scoped diagnostics route. */
export interface InteractiveRenderDiagnostic {
  code: "render-error";
  colorScheme?: InteractiveBootstrap["colorScheme"];
  entryId?: string;
  entryKind?: InteractiveBootstrap["entryKind"];
  message: string;
  variantId?: string;
  viewport?: InteractiveBootstrap["viewport"];
}

/** Injectable side-effect boundary for browser render diagnostics. */
export interface InteractiveDiagnosticReporter {
  report(diagnostic: InteractiveRenderDiagnostic): void;
}

/** Console and same-origin HTTP reporter used by the package browser entry. */
export class HttpInteractiveDiagnosticReporter implements InteractiveDiagnosticReporter {
  constructor(
    private readonly generation?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  report(diagnostic: InteractiveRenderDiagnostic): void {
    console.error(`[mokly/render-error] ${diagnostic.message}`);
    if (!this.generation) return;
    const fetcher = this.fetcher;
    try {
      void fetcher(`/__mokly/interactive/${this.generation}/diagnostics`, {
        body: JSON.stringify(diagnostic),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => undefined);
    } catch {
      // Reporting must not replace the original React failure.
    }
  }
}

/** Convert an unknown React error into the documented bounded payload. */
export function renderDiagnostic(
  bootstrap: InteractiveBootstrap | undefined,
  error: unknown,
): InteractiveRenderDiagnostic {
  const raw = error instanceof Error ? error.message : String(error);
  return {
    code: "render-error",
    message: raw.slice(0, MESSAGE_LIMIT),
    ...(bootstrap
      ? {
          colorScheme: bootstrap.colorScheme,
          entryId: bootstrap.entryId,
          entryKind: bootstrap.entryKind,
          ...(bootstrap.variantId ? { variantId: bootstrap.variantId } : {}),
          viewport: bootstrap.viewport,
        }
      : {}),
  };
}
