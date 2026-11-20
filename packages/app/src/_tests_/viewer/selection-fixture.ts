import type { ViewerSelection } from "../../viewer/host";

export function selection(
  over: Partial<ViewerSelection> = {},
): ViewerSelection {
  return {
    view: "all",
    viewport: "desktop",
    scheme: "light",
    search: "",
    tags: [],
    ...over,
  };
}
