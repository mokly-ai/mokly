import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import type { FrameNavigation } from "../client/frame_adapter.js";
import { isLogicalFragment } from "../navigation/logical.js";
import { parseViewAxes } from "../navigation/view_axes.js";

import type { ViewerEvents, ViewerSelection } from "./types.js";

interface RouteIntent {
  colorScheme?: "dark" | "light";
  id: string | null;
  snapshotId?: string;
  variantId?: string;
  fragment?: string;
  navigation?: FrameNavigation;
  viewport?: "both" | "desktop" | "mobile";
}
interface RouteActions {
  selection(): ViewerSelection;
  select(value: Partial<ViewerSelection>): void;
  refresh(): void;
  endPick(): void;
  open(url: string, target: string, features: string): unknown;
  events(): ViewerEvents;
}

/** Fragments stay local; saved variants commit through public selection. */
export class ViewerRouting {
  fragment: string | undefined;
  private pending: RouteIntent | undefined;
  private announced: string;
  constructor(
    private model: CatalogueReadModel,
    private baseUrl: URL,
    private actions: RouteActions,
  ) {
    this.announced = this.key();
  }
  private entry() {
    const selection = this.actions.selection();
    return typeof selection.screenId === "string"
      ? resolveCatalogueSelection(
          this.model,
          selection.screenId,
          selection.snapshotId,
        )?.entry
      : undefined;
  }
  private effectiveVariant() {
    const entry = this.entry();
    return (
      this.actions.selection().variantId ??
      (entry?.kind === "component" ? entry.variants[0]?.id : undefined)
    );
  }
  private key() {
    return JSON.stringify([
      this.actions.selection().screenId,
      this.actions.selection().snapshotId,
      this.effectiveVariant(),
      this.fragment,
    ]);
  }
  commit(selection: ViewerSelection, screenChanged: boolean): void {
    const intent =
      this.pending?.id === selection.screenId &&
      this.pending.snapshotId === selection.snapshotId &&
      this.pending.variantId === selection.variantId &&
      (this.pending.viewport === undefined ||
        this.pending.viewport === selection.viewport) &&
      (this.pending.colorScheme === undefined ||
        this.pending.colorScheme === selection.colorScheme)
        ? this.pending
        : undefined;
    if (intent) this.fragment = intent.fragment;
    else if (screenChanged) this.fragment = undefined;
  }
  announce(navigation = this.pending?.navigation): void {
    this.pending = undefined;
    const key = this.key();
    if (key === this.announced) return;
    this.announced = key;
    const entry = this.entry();
    const variantId = this.effectiveVariant();
    const snapshotId = this.actions.selection().snapshotId;
    if (entry)
      this.actions.events().onScreenNavigate?.({
        screenId: entry.id,
        route: entry.route,
        ...(snapshotId ? { snapshotId } : {}),
        ...(variantId ? { variantId } : {}),
        ...(this.fragment ? { fragment: this.fragment } : {}),
        ...(navigation ? { navigation } : {}),
      });
  }
  shell(id: string | null, url: URL): void {
    const fragment = url.searchParams.getAll("fragment");
    const snapshots = url.searchParams.getAll("snapshot");
    const variant = url.searchParams.getAll("variant");
    this.request({
      id,
      ...(snapshots.length === 1 && isHistoricalSnapshotId(snapshots[0])
        ? { snapshotId: snapshots[0] }
        : {}),
      ...parseViewAxes(url.searchParams),
      ...(variant.length === 1 ? { variantId: variant[0]! } : {}),
      ...(fragment.length === 1 && isLogicalFragment(fragment[0]!)
        ? { fragment: fragment[0]! }
        : {}),
    });
  }
  frame(navigation: FrameNavigation): void {
    const selected = resolveCatalogueSelection(this.model, navigation.id);
    const entry = selected?.entry;
    if (!entry || !selected) return;
    if (
      navigation.target.kind === "blank" ||
      navigation.target.kind === "named" ||
      (navigation.target.kind === "self" && navigation.activation !== "primary")
    ) {
      const url = new URL(`/view/${entry.route}`, this.baseUrl);
      if (selected.snapshotId)
        url.searchParams.set("snapshot", selected.snapshotId);
      if (navigation.fragment)
        url.searchParams.set("fragment", navigation.fragment);
      this.actions.open(
        url.href,
        navigation.target.kind === "named" ? navigation.target.name : "_blank",
        "noopener",
      );
      return;
    }
    this.request({
      id: entry.id,
      ...(selected.snapshotId ? { snapshotId: selected.snapshotId } : {}),
      navigation,
      ...(navigation.fragment ? { fragment: navigation.fragment } : {}),
    });
  }
  private request(intent: RouteIntent): void {
    this.pending = intent;
    const selection = this.actions.selection();
    if (
      intent.id !== selection.screenId ||
      intent.snapshotId !== selection.snapshotId ||
      intent.variantId !== selection.variantId ||
      (intent.viewport !== undefined &&
        intent.viewport !== selection.viewport) ||
      (intent.colorScheme !== undefined &&
        intent.colorScheme !== selection.colorScheme)
    ) {
      this.actions.select({
        screenId: intent.id,
        ...(intent.snapshotId ? { snapshotId: intent.snapshotId } : {}),
        variantId: intent.variantId,
        ...(intent.viewport ? { viewport: intent.viewport } : {}),
        ...(intent.colorScheme ? { colorScheme: intent.colorScheme } : {}),
      });
      return;
    }
    const before = this.key();
    this.commit(selection, false);
    if (before === this.key()) {
      this.pending = undefined;
      return;
    }
    this.actions.endPick();
    this.actions.refresh();
    this.announce();
  }
}
