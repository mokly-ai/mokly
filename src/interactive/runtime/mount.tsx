import { type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import type { RegistryDefinition } from "../../authoring/types.js";
import { componentInputs } from "../../components/inputs.js";
import { ComponentContext } from "../../components/render_context.js";
import type { ComponentDefinition } from "../../components/types.js";
import type { InteractiveRenderer } from "../../renderer/types.js";
import type { InteractiveBootstrap } from "../types.js";

import { readInteractiveBootstrap } from "./bootstrap.js";
import {
  HttpInteractiveDiagnosticReporter,
  renderDiagnostic,
  type InteractiveDiagnosticReporter,
} from "./diagnostics.js";
import {
  configureInteractiveRoutes,
  installInteractiveLinkResolver,
} from "./route_context.js";

/** Dependencies supplied by the package browser entry or a runtime test. */
export interface InteractiveMountInput {
  definitions: readonly RegistryDefinition[];
  document?: Document;
  interactiveRenderer?: InteractiveRenderer;
  reporter?: InteractiveDiagnosticReporter;
}

/** Mounted root and resolver cleanup owned by one Live document. */
export interface InteractiveMount {
  root: Root;
  unmount(): void;
}

/** Read one Live bootstrap and synchronously replace its static body children. */
export function mountInteractiveDocument(
  input: InteractiveMountInput,
): InteractiveMount {
  const document = input.document ?? globalThis.document;
  const reporter =
    input.reporter ??
    new HttpInteractiveDiagnosticReporter(diagnosticGeneration(document));
  let bootstrap: InteractiveBootstrap | undefined;
  let reported = false;
  const report = (error: unknown) => {
    if (reported) return;
    reported = true;
    try {
      reporter.report(renderDiagnostic(bootstrap, error));
    } catch {
      // Diagnostics must not replace the render failure or its static fallback.
    }
  };
  let selection: InteractiveSelection;
  try {
    bootstrap = readInteractiveBootstrap(document);
    selection = interactiveSelection(input.definitions, bootstrap);
    configureInteractiveRoutes(bootstrap.routes, document);
  } catch (error) {
    report(error);
    throw error;
  }
  const staticChildren = [...document.body.childNodes];
  const rootState: { active: boolean; root?: Root } = { active: false };
  let restorationQueued = false;
  let restored = false;
  let disposeLinks: () => void = () => undefined;
  const unmountRoot = () => {
    if (!rootState.active || !rootState.root) return;
    rootState.active = false;
    rootState.root.unmount();
  };
  const restoreStaticDocument = () => {
    if (restored) return;
    restored = true;
    disposeLinks();
    try {
      unmountRoot();
    } finally {
      document.body.replaceChildren(...staticChildren);
    }
  };
  const queueRestoration = () => {
    if (restorationQueued) return;
    restorationQueued = true;
    queueMicrotask(restoreStaticDocument);
  };
  const root = (() => {
    try {
      return createRoot(document.body, {
        onCaughtError: report,
        onUncaughtError(error) {
          report(error);
          queueRestoration();
        },
      });
    } catch (error) {
      report(error);
      throw error;
    }
  })();
  rootState.root = root;
  rootState.active = true;
  try {
    flushSync(() => {
      root.render(
        <ComponentContext
          value={{
            context: {
              colorScheme: bootstrap.colorScheme,
              viewport: bootstrap.viewport,
            },
            kind: "interactive",
          }}
        >
          <InteractiveView
            bootstrap={bootstrap}
            entry={selection.entry}
            {...(selection.componentProps
              ? { componentProps: selection.componentProps }
              : {})}
            {...(input.interactiveRenderer
              ? { interactiveRenderer: input.interactiveRenderer }
              : {})}
          />
        </ComponentContext>,
      );
    });
  } catch (error) {
    report(error);
    queueRestoration();
    throw error;
  }
  try {
    disposeLinks = installInteractiveLinkResolver(document);
  } catch (error) {
    report(error);
    queueRestoration();
    throw error;
  }
  return {
    root,
    unmount() {
      disposeLinks();
      unmountRoot();
    },
  };
}

interface InteractiveSelection {
  componentProps?: Readonly<Record<string, unknown>>;
  entry: Extract<RegistryDefinition, { kind: "component" | "screen" }>;
}

function interactiveSelection(
  definitions: readonly RegistryDefinition[],
  bootstrap: InteractiveBootstrap,
): InteractiveSelection {
  const entry = definitions.find(
    (candidate) => candidate.id === bootstrap.entryId,
  );
  if (!entry || entry.kind !== bootstrap.entryKind)
    throw new Error("Live entry is missing from the browser registry.");
  if (entry.kind !== "screen" && entry.kind !== "component")
    throw new Error("Live entry has an unsupported kind.");
  if (entry.kind === "screen") return { entry };
  return {
    componentProps: componentVariantProps(entry, bootstrap.variantId),
    entry,
  };
}

function InteractiveView({
  bootstrap,
  componentProps,
  entry,
  interactiveRenderer,
}: {
  bootstrap: InteractiveBootstrap;
  componentProps?: Readonly<Record<string, unknown>>;
  entry: Extract<RegistryDefinition, { kind: "component" | "screen" }>;
  interactiveRenderer?: InteractiveRenderer;
}): ReactNode {
  const node =
    entry.kind === "screen"
      ? entry[bootstrap.viewport]
      : renderComponent(entry, componentProps!, bootstrap);
  if (!interactiveRenderer) return node;
  return interactiveRenderer({
    colorScheme: bootstrap.colorScheme,
    entry,
    node,
    viewport: bootstrap.viewport,
    ...(bootstrap.variantId ? { variantId: bootstrap.variantId } : {}),
    ...(componentProps ? { componentProps } : {}),
  });
}

function diagnosticGeneration(document: Document): string | undefined {
  const generations = [
    ...document.querySelectorAll<HTMLScriptElement>(
      'script[type="module"][src]',
    ),
  ].flatMap((script) => {
    const match =
      /^\/__mokly\/interactive\/([A-Za-z0-9_-]{1,128})\/bundle\.js$/.exec(
        script.getAttribute("src") ?? "",
      );
    return match?.[1] ? [match[1]] : [];
  });
  return generations.length === 1 ? generations[0] : undefined;
}

function componentVariantProps(
  entry: ComponentDefinition,
  variantId: string | undefined,
): Readonly<Record<string, unknown>> {
  const variant = entry.variants.find(
    (candidate) => candidate.id === variantId,
  );
  if (!variant) throw new Error("Live component variant is missing.");
  return variant.props;
}

function renderComponent(
  entry: ComponentDefinition,
  props: Readonly<Record<string, unknown>>,
  bootstrap: InteractiveBootstrap,
): ReactNode {
  const { data, slots } = componentInputs(
    entry,
    props,
    `${entry.id} / ${bootstrap.variantId ?? "Live"}`,
  );
  return entry.render(
    { ...data, ...slots },
    { colorScheme: bootstrap.colorScheme, viewport: bootstrap.viewport },
  );
}
