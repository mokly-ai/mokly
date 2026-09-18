/** Local-only temporary editing, with saved and transient evidence kept together. */
import { encodeProps, decodeProps } from "../components/codec.js";
import type { ComponentPropsData } from "../components/prop_types.js";
import type {
  ComponentOverride,
  ComponentRenderSuccess,
} from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import type {
  WorkspaceData,
  WorkspaceVariant,
} from "../shell/workspace_data.js";

import { currentColorScheme, setColorScheme } from "./browse_state.js";
import { controlFields, type ControlFields } from "./control_fields.js";
import { controlSurface, controlsUnavailable } from "./control_surface.js";
import { controlViewKey } from "./control_view_key.js";
import { renderProps } from "./inspector_panels.js";
import { viewerServices } from "./services.js";
import { applyVariant } from "./workspace_variants.js";

export class ComponentControls {
  private readonly ui: ReturnType<typeof controlSurface>;
  private fields: ControlFields | undefined;
  private variant: WorkspaceVariant | undefined;
  private contexts: readonly GeneratedComponentView[] = [];
  private contextKey = "";
  private comparing = false;
  private edits: Readonly<Record<string, ComponentOverride>> = {};
  private previews = new Map<string, ComponentRenderSuccess>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: AbortController | undefined;
  private sequence = 0;
  private disposed = false;
  private dirty = false;
  private readonly pageId = crypto.randomUUID().replaceAll("-", "");

  constructor(
    private readonly root: HTMLElement,
    private readonly data: WorkspaceData,
    signal: AbortSignal,
    private readonly changed: () => void,
  ) {
    this.ui = controlSurface(
      root.ownerDocument,
      () => {
        this.reset();
        this.buildFields();
        this.changed();
      },
      () => this.edit(true),
    );
    signal.addEventListener(
      "abort",
      () => {
        this.disposed = true;
        this.cancel();
      },
      { once: true },
    );
    for (const frame of root.querySelectorAll<HTMLIFrameElement>(
      "iframe[data-workspace-frame]",
    ))
      frame.addEventListener(
        "load",
        () => void this.verifyLoaded(frame, signal),
        { signal },
      );
  }
  sync(
    variant: WorkspaceVariant | undefined,
    contexts: readonly GeneratedComponentView[],
    comparing: boolean,
  ): void {
    const changedVariant = this.variant?.value.id !== variant?.value.id;
    this.variant = variant;
    this.contexts = contexts;
    const contextKey = contexts.map(controlViewKey).join("|");
    const changedContext = this.contextKey !== contextKey;
    this.contextKey = contextKey;
    if (changedVariant || (comparing && !this.comparing)) {
      this.reset();
      this.buildFields();
    }
    this.comparing = comparing;
    const disabled = this.unavailable();
    this.fields?.disable(Boolean(disabled));
    if (disabled) {
      this.ui.status.textContent = disabled;
      this.ui.resetButton.disabled = true;
    } else this.ui.resetButton.disabled = !this.dirty;
    if (changedContext && !changedVariant && !disabled) {
      this.cancel();
      const edits = this.fields?.read() ?? this.edits;
      if (Object.keys(edits).length) void this.render(edits);
      else this.ui.status.textContent = "Saved props";
    }
  }
  mount(panel: HTMLElement): void {
    if (this.ui.panel.parentElement !== panel)
      panel.replaceChildren(this.ui.panel);
  }
  views(
    saved: readonly GeneratedComponentView[],
  ): readonly GeneratedComponentView[] {
    return saved.map((view) => {
      const preview = this.previews.get(controlViewKey(view));
      return preview
        ? {
            ...view,
            path: decodeURIComponent(preview.previewUrl),
            usage: preview.view,
          }
        : view;
    });
  }
  props() {
    const context = this.contexts[0];
    return (
      (context
        ? this.previews.get(controlViewKey(context))?.props
        : undefined) ?? this.variant?.value.props
    );
  }
  private unavailable(): string | undefined {
    return controlsUnavailable(this.data, this.variant, this.comparing);
  }
  private buildFields(): void {
    if (this.data.entry.kind !== "component" || !this.variant) {
      this.ui.form.replaceChildren();
      return;
    }
    this.fields = controlFields(
      this.root.ownerDocument,
      this.data.entry,
      this.variant.value,
      (immediate) => this.edit(immediate),
    );
    this.ui.form.replaceChildren(this.fields.root);
    this.details(this.variant.value.props);
  }
  private details(
    props: NonNullable<ReturnType<ComponentControls["props"]>>,
  ): void {
    const component = this.data.entry;
    if (component.kind !== "component") return;
    const other: ComponentPropsData = Object.fromEntries(
      Object.entries(decodeProps(props)).filter(
        ([name]) => !Object.hasOwn(component.controls, name),
      ),
    );
    renderProps(this.ui.propsPanel, this.data, {
      props: encodeProps(other),
      slots: this.variant?.value.suppliedSlots ?? [],
    });
    if (!Object.keys(other).length && !this.variant?.value.suppliedSlots.length)
      this.ui.propsPanel.replaceChildren();
  }
  private edit(immediate: boolean): void {
    if (this.unavailable()) return;
    this.cancel();
    this.ui.error.hidden = true;
    this.ui.retry.hidden = true;
    const overrides = this.fields?.read();
    this.dirty = true;
    this.ui.resetButton.disabled = false;
    if (!overrides) {
      this.ui.status.textContent =
        "Check the highlighted values. The preview shows the last valid props.";
      return;
    }
    this.ui.error.hidden = true;
    this.ui.retry.hidden = true;
    const submit = () => {
      if (!Object.keys(overrides).length) {
        this.reset();
        this.changed();
      } else void this.render(overrides);
    };
    if (immediate) submit();
    else this.timer = setTimeout(submit, 150);
  }
  private async render(
    overrides: Readonly<Record<string, ComponentOverride>>,
  ): Promise<void> {
    const capability = this.data.renderCapability;
    const variant = this.variant;
    if (!capability || !variant || this.unavailable()) return;
    this.cancel();
    const sequence = this.sequence;
    const controller = new AbortController();
    this.request = controller;
    this.ui.status.textContent = "Updating preview…";
    this.ui.error.hidden = true;
    this.ui.retry.hidden = true;
    const previews = new Map<string, ComponentRenderSuccess>();
    try {
      for (const view of this.contexts)
        previews.set(
          controlViewKey(view),
          await viewerServices(
            this.root.ownerDocument,
          )!.requestComponentPreview(
            {
              componentId: this.data.entry.id,
              variantId: variant.value.id,
              viewport: view.viewport,
              colorScheme: view.colorScheme,
              generation: capability.generation,
              pageId: this.pageId,
              overrides,
            },
            capability,
            view,
            controller.signal,
          ),
        );
      if (
        controller.signal.aborted ||
        sequence !== this.sequence ||
        this.disposed
      )
        return;
      for (const [context, preview] of previews)
        this.previews.set(context, preview);
      this.edits = overrides;
      for (const result of previews.values()) {
        const frame = this.root.querySelector<HTMLIFrameElement>(
          `iframe[data-workspace-frame="${result.view.viewport}"]`,
        );
        if (frame)
          frame.setAttribute(
            `data-fragment-${result.view.colorScheme}`,
            result.previewUrl,
          );
      }
      setColorScheme(
        this.root.ownerDocument,
        currentColorScheme(this.root.ownerDocument),
      );
      this.ui.status.textContent = "Edited props";
      this.ui.resetButton.disabled = false;
      const props = this.props();
      if (props) this.details(props);
      this.changed();
    } catch (error) {
      if (
        controller.signal.aborted ||
        sequence !== this.sequence ||
        this.disposed
      )
        return;
      this.ui.status.textContent = "The preview shows the last valid props.";
      this.ui.error.textContent =
        error instanceof Error
          ? error.message
          : "The preview could not be updated. Try again.";
      this.ui.error.hidden = false;
      this.ui.retry.hidden = false;
    }
  }
  private cancel(): void {
    this.sequence++;
    clearTimeout(this.timer);
    this.request?.abort();
    this.request = undefined;
  }
  private async verifyLoaded(
    frame: HTMLIFrameElement,
    signal: AbortSignal,
  ): Promise<void> {
    const sequence = this.sequence;
    try {
      const expired = await viewerServices(
        this.root.ownerDocument,
      )!.componentPreviewExpired(frame, this.previews.values(), signal);
      if (this.disposed || sequence !== this.sequence || !expired) return;
      this.ui.status.textContent = "The temporary preview expired.";
      this.ui.error.textContent =
        "Render it again to continue with these props.";
      this.ui.error.hidden = false;
      this.ui.retry.hidden = false;
    } catch {
      /* Navigation and disconnects invalidate this optional lifetime check. */
    }
  }
  private reset(): void {
    this.cancel();
    this.dirty = false;
    this.edits = {};
    this.previews.clear();
    this.ui.error.hidden = true;
    this.ui.retry.hidden = true;
    this.ui.status.textContent = "Saved props";
    this.ui.resetButton.disabled = true;
    if (this.variant) applyVariant(this.root, this.data, this.variant);
  }
}
