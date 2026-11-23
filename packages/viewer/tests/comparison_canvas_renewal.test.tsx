/**
 * A change of the shown frames under the selected comparisons contract: the
 * canvas renews the row's loaded generation before the new frames' documents
 * load, and a generation that the renewal lost is reacquired with a new
 * selection, so no document ever loads from the lost generation.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, render } from "@testing-library/react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";

import { ComparisonCanvas } from "../src/shell/comparison_canvas.js";
import { useCanvasComparison } from "../src/shell/comparison_canvas_context.js";
import type { ComparisonFramePlan } from "../src/shell/comparison_rows.js";
import { comparedFrames } from "../src/shell/comparison_selection.js";
import {
  useComparison,
  type ComparisonController,
} from "../src/shell/use_comparison.js";

import {
  answerDocuments,
  generationRoot,
  heldHost,
  response,
} from "./comparison_lifecycle_harness.js";
import { flush } from "./data_fakes.js";
import { ShellStoreFixture } from "./shell_markup.js";

/** The routed screen of the fixture catalogue, whose two views changed. */
const HOME = "product/browse/home";

/** A Light frame of the screen. */
function plan(viewport: "desktop" | "mobile"): ComparisonFramePlan {
  const name = `${viewport === "desktop" ? "Desktop" : "Mobile"} · Light`;
  return {
    column: viewport === "desktop" ? 0 : 1,
    entry: { path: HOME },
    key: `${viewport}-light`,
    kind: viewport,
    label: name,
    name,
    row: 0,
    scheme: "light",
    viewport,
  };
}

const DESKTOP = plan("desktop");
const MOBILE = plan("mobile");

/** The screen's changed Light view of each viewport. */
function rows() {
  return {
    compared: {
      basePath: HOME,
      path: HOME,
      reasons: [],
      views: (["desktop", "mobile"] as const).map((viewport) => ({
        colorScheme: "light" as const,
        ignoredIds: [],
        state: "changed" as const,
        viewport,
      })),
    },
    usingChanged: new Set<string>(),
  };
}

/** The keys of the frames that the canvas shows, as the compare gives them. */
function Probe({ shown }: { shown: readonly ComparisonFramePlan[] }) {
  const comparison = useCanvasComparison();
  const live: CanvasSectionFrame[] = shown.map(({ column, key, row }) => ({
    column,
    height: 800,
    key,
    node: null,
    row,
    width: 1280,
  }));
  const frames = comparison ? comparison.frames(live) : live;
  const visible = frames.filter((frame) => !frame.hidden);
  return <p data-testid="frames">{visible.map((frame) => frame.key).join()}</p>;
}

/** The comparison of the screen's shown frames, on its canvas. */
function Workspace({
  shown,
  onController,
}: {
  shown: readonly ComparisonFramePlan[];
  onController: (controller: ComparisonController) => void;
}) {
  const comparison = useComparison({
    eligible: true,
    eligibilityKnown: true,
    entryId: HOME,
    frames: shown,
  });
  onController(comparison);
  const generations = comparison.generations;
  return (
    <ComparisonCanvas
      comparison={comparison}
      entryId={HOME}
      entryKind="screen"
      frames={generations ? comparedFrames(shown, generations, rows) : []}
      plans={new Map(shown.map((frame) => [frame.key, frame]))}
      sideKey={undefined}
    >
      <Probe shown={shown} />
    </ComparisonCanvas>
  );
}

test("a change of the shown frames renews the row before its documents load, and a lost generation is selected again", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = heldHost();
  const first = generationRoot("home-1");
  const second = generationRoot("home-2");
  const documents = (from: number) =>
    host.requests
      .slice(from)
      .filter(({ url }) => url.pathname.includes("/snapshots/"));
  let controller: ComparisonController | undefined;
  const keep = (value: ComparisonController) => {
    controller = value;
  };
  const markup = (shown: readonly ComparisonFramePlan[]) => (
    <ShellStoreFixture
      comparisonEnvironment={host.environment}
      path={`/view/${HOME}/`}
    >
      <Workspace onController={keep} shown={shown} />
    </ShellStoreFixture>
  );
  const view = render(markup([DESKTOP]));
  try {
    await act(async () => controller?.selectMode("overlay"));
    assert.deepEqual(host.labels(), [`GET ${HOME}`]);
    await act(async () => {
      host.requests[0]!.answer(first);
      await flush();
    });
    await answerDocuments(documents(1));
    assert.equal(
      view.getByTestId("frames").textContent,
      "compare:desktop-light",
    );
    const changed = host.requests.length;
    // The canvas shows Mobile · Light too: the row renews before it loads.
    view.rerender(markup([DESKTOP, MOBILE]));
    await act(flush);
    assert.deepEqual(host.labels().slice(changed), ["HEAD home-1"]);
    // The generation is gone: its row is selected again, without refresh.
    await act(async () => {
      host.requests[changed]!.respond(response(first, 404));
      await flush();
    });
    assert.deepEqual(host.labels().slice(changed + 1), [`GET ${HOME}`]);
    await act(async () => {
      host.requests[changed + 1]!.answer(second);
      await flush();
    });
    const loaded = documents(changed);
    assert.equal(loaded.length, 4);
    for (const { url } of loaded)
      assert.ok(url.href.startsWith(second), `${url.href} is in ${second}`);
    await answerDocuments(loaded);
    assert.equal(
      view.getByTestId("frames").textContent,
      "compare:desktop-light,compare:mobile-light",
    );
    assert.equal(
      view.queryAllByText("The comparison could not be loaded.").length,
      0,
    );
  } finally {
    view.unmount();
  }
});
