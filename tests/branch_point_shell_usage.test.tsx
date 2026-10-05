import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { ShellFrameRegistry } from "../packages/viewer/src/shell/frame_registry.js";
import type { ShellFrameSession } from "../packages/viewer/src/shell/frame_registry.js";
import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";
import { workspaceHighlightLabels } from "../packages/viewer/src/shell/workspace_inspection_labels.js";
import { WorkspaceInstances } from "../packages/viewer/src/shell/workspace_instances.js";
import { WorkspaceProps } from "../packages/viewer/src/shell/workspace_props.js";
import { viewerInspectionLabels } from "../packages/viewer/src/viewer/inspection_labels.js";

import { branchPointShell, routedEntry } from "./helpers/branch_point_shell.js";

test("removed screens show resolved component titles and links in every shell", async (t) => {
  const shell = await branchPointShell("removed-screen-usage");
  t.after(shell.remove);
  for (const side of shell.sides)
    for (const [path, title, component] of [
      ["shop/receipt", "Badge", "library/ui/badge"],
      ["shop/case-receipt", "Pill", "library/pill"],
    ] as const) {
      const entry = routedEntry(side, path);
      const data = workspaceData(side.catalogue, side.context(entry), entry);
      const view = data.views[0]!;
      const instance = view.usage!.instances[0]!;
      const list = renderToStaticMarkup(
        <WorkspaceInstances
          catalogue={side.catalogue}
          activeViewport="mobile"
          data={data}
          onFocus={() => undefined}
          onSelect={() => undefined}
          onViewport={() => undefined}
          views={[view]}
        />,
      );
      assert.match(list, new RegExp(`>${title} · ${instance.id}<`), side.name);
      const props = renderToStaticMarkup(
        <WorkspaceProps
          catalogue={side.catalogue}
          data={data}
          selection={{ instance, usage: view.usage! }}
        />,
      );
      assert.match(
        props,
        new RegExp(`<h3>${title} · ${instance.id}</h3>`),
        side.name,
      );
      assert.ok(props.includes(`href="/view/${component}/"`), side.name);
      assert.match(props, /Open component/);
    }
});

test("the embedded Used by list matches historical usage through moves and case changes", async (t) => {
  const shell = await branchPointShell("removed-screen-usage");
  t.after(shell.remove);
  const side = shell.sides[1];
  for (const [parent, screen] of [
    ["library/ui/badge", "shop/receipt"],
    ["library/pill", "shop/case-receipt"],
  ] as const) {
    const entry = routedEntry(side, parent);
    const data = workspaceData(side.catalogue, side.context(entry), entry);
    assert.deepEqual(
      [
        ...new Set(
          data.usedBy.map((link) => [link.entryId, link.removed].join(":")),
        ),
      ],
      [`${screen}:true`],
    );
  }
});

test("workspace Highlight labels resolve the original usage names", async (t) => {
  const shell = await branchPointShell("removed-screen-usage");
  t.after(shell.remove);
  const side = shell.sides[0];
  const model = readCatalogue(shell.sides[1].catalogue.publicModel);
  const frame = {
    nodeType: 1,
    parentElement: null,
    offsetWidth: 100,
    offsetHeight: 100,
    clientLeft: 0,
    clientTop: 0,
    ownerDocument: {
      defaultView: {
        innerWidth: 500,
        innerHeight: 500,
        getComputedStyle: () => ({ visibility: "visible", opacity: "1" }),
      },
    },
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
    }),
    getClientRects: () => [{ left: 0, top: 0, right: 100, bottom: 100 }],
  } as unknown as HTMLIFrameElement;
  for (const [path, title] of [
    ["shop/receipt", "Badge"],
    ["shop/case-receipt", "Pill"],
  ]) {
    const entry = routedEntry(side, path!);
    const data = workspaceData(side.catalogue, side.context(entry), entry);
    const view = data.views[0]!;
    const usage = view.usage!;
    const instance = usage.instances[0]!;
    const session = {
      element: frame,
      generation: 1,
      identity: { entryPath: entry.path, viewport: view.viewport },
      usage: { ...usage, status: "ready" },
    } as unknown as ShellFrameSession;
    const labels = workspaceHighlightLabels(
      data,
      [
        {
          session,
          keys: [instance.key],
          boundaries: [
            {
              key: instance.key,
              ranges: [
                { id: "r-0", boxes: [{ x: 10, y: 30, width: 40, height: 20 }] },
              ],
            },
          ],
        },
      ],
      side.catalogue,
    );
    assert.deepEqual(
      labels.map((label) => label.text),
      [`${title} · ${instance.id}`],
    );
    const registry = {
      geometry: {
        snapshot: () => ({
          result: {
            kind: "ready",
            boundaries: [
              {
                key: instance.key,
                ranges: [
                  {
                    id: "r-0",
                    boxes: [{ x: 10, y: 30, width: 40, height: 20 }],
                  },
                ],
              },
            ],
          },
        }),
      },
    } as unknown as ShellFrameRegistry;
    const viewerLabels = viewerInspectionLabels(
      model,
      frame,
      [{ session, keys: [instance.key] }],
      registry,
    );
    assert.deepEqual(
      viewerLabels.map((label) => label.text),
      [`${title} · ${instance.id}`],
    );
  }
});
