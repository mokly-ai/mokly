import type {
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerSelection,
} from "@mokly/viewer";

export interface ViewerHost {
  ref: { current: MoklyViewerHandle };
  props: MoklyViewerProps;
  events: { name: string; value: unknown }[];
  render(): void;
  setSelection(value: ViewerSelection): void;
}
interface Harness {
  start(id: string, options?: Record<string, unknown>): ViewerHost;
  get(id: string): ViewerHost;
  remove(id: string): void;
}
declare global {
  interface Window {
    viewerHarness: Harness;
  }
}
