import type { CatalogueReadModel } from "../catalogue/types.js";
import type { FrameNavigation } from "../client/frame_adapter.js";
import { isLogicalFragment } from "../navigation/logical.js";

import { routedEntries } from "./selection.js";
import type { ViewerEvents, ViewerSelection } from "./types.js";

interface RouteIntent {
  id: string | null;
  variantId?: string;
  fragment?: string;
  viewport?: ViewerSelection["viewport"];
  colorScheme?: ViewerSelection["colorScheme"];
  navigation?: FrameNavigation;
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
    return routedEntries(this.model).find(
      (entry) => entry.id === this.actions.selection().screenId,
    );
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
      this.effectiveVariant(),
      this.fragment,
    ]);
  }
  commit(selection: ViewerSelection, screenChanged: boolean): void {
    const intent =
      this.pending?.id === selection.screenId &&
      this.pending.variantId === selection.variantId
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
    if (entry)
      this.actions.events().onScreenNavigate?.({
        screenId: entry.id,
        route: entry.route,
        ...(variantId ? { variantId } : {}),
        ...(this.fragment ? { fragment: this.fragment } : {}),
        ...(navigation ? { navigation } : {}),
      });
  }
  shell(
    id: string | null,
    url: URL,
    axes?: Pick<ViewerSelection, "viewport" | "colorScheme">,
  ): void {
    const fragment = url.searchParams.getAll("fragment");
    const variant = url.searchParams.getAll("variant");
    this.request({
      id,
      ...(variant.length === 1 ? { variantId: variant[0]! } : {}),
      ...(fragment.length === 1 && isLogicalFragment(fragment[0]!)
        ? { fragment: fragment[0]! }
        : {}),
      ...axes,
    });
  }
  frame(navigation: FrameNavigation): void {
    const entry = routedEntries(this.model).find(
      (entry) => entry.id === navigation.id,
    );
    if (!entry) return;
    if (
      navigation.target.kind === "blank" ||
      navigation.target.kind === "named" ||
      (navigation.target.kind === "self" && navigation.activation !== "primary")
    ) {
      const url = new URL(`/view/${entry.route}`, this.baseUrl);
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
      navigation,
      ...(navigation.fragment ? { fragment: navigation.fragment } : {}),
    });
  }
  private request(intent: RouteIntent): void {
    const selection = this.actions.selection();
    const routeChanged =
      intent.id !== selection.screenId ||
      intent.variantId !== selection.variantId;
    const axesChanged =
      (intent.viewport !== undefined &&
        intent.viewport !== selection.viewport) ||
      (intent.colorScheme !== undefined &&
        intent.colorScheme !== selection.colorScheme);
    if (routeChanged || axesChanged) {
      this.pending = intent;
      this.actions.select({
        screenId: intent.id,
        variantId: intent.variantId,
        ...(intent.viewport === undefined ? {} : { viewport: intent.viewport }),
        ...(intent.colorScheme === undefined
          ? {}
          : { colorScheme: intent.colorScheme }),
      });
      return;
    }
    this.pending = intent;
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
