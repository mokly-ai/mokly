import { FakeNode } from "./fake_dom.js";

/** Fake workspace controls and comparison band used by shown-status tests. */
export function fakeStatusWorkspace() {
  const dots = {
    scheme: new FakeNode("span", { "data-view-changed": "scheme" }),
    viewport: new FakeNode("span", { "data-view-changed": "viewport" }),
  };
  const texts = {
    scheme: new FakeNode("span", { "data-view-changed-text": "scheme" }),
    viewport: new FakeNode("span", { "data-view-changed-text": "viewport" }),
  };
  const controls = {
    scheme: new FakeNode("button", { "data-workspace-scheme": "" }),
    viewport: new FakeNode("select", { "data-workspace-viewport": "" }),
  };
  const value = new FakeNode("span", {
    "data-workspace-changed-views-value": "",
  });
  const row = new FakeNode("div", {
    "data-workspace-changed-views": "",
  }).append(value);
  const status = new FakeNode("span", { "data-workspace-status": "" });
  const current = new FakeNode("button", {
    "aria-pressed": "true",
    "data-diff-mode": "current",
  });
  const side = new FakeNode("button", {
    "aria-pressed": "false",
    "data-diff-mode": "side",
  });
  const toolbar = new FakeNode("div").append(current, side);
  toolbar.classList.add("mbk-diff-toolbar");
  (current as unknown as { click(): void }).click = () => {
    current.setAttribute("aria-pressed", "true");
    side.setAttribute("aria-pressed", "false");
  };
  const root = new FakeNode("section", { "data-workspace": "" }).append(
    status,
    toolbar,
    new FakeNode("label").append(
      controls.viewport,
      dots.viewport,
      texts.viewport,
    ),
    controls.scheme.append(dots.scheme, texts.scheme),
    row,
  );
  return {
    control: (kind: "scheme" | "viewport") => controls[kind],
    current,
    dot: (kind: "scheme" | "viewport") => dots[kind],
    root: root as unknown as HTMLElement,
    row,
    side,
    status,
    text: (kind: "scheme" | "viewport") => texts[kind],
    toolbar,
    value,
  };
}
