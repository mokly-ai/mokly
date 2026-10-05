import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  DesignStyleCollector,
  DesignStyles,
  useDesignStyle,
} from "../examples/basic/specs/design/library/style_context.js";
import type { LibraryStyle } from "../examples/basic/specs/design/library/style_files.js";

const configured = [
  "../../../design.css",
  "../../../design-library/controls/tag-chip.css",
  "../../../design-library/chrome/top-bar.css",
  "../../../design-stage.css",
];

function Sample({
  name,
  visible = true,
}: {
  name: LibraryStyle;
  visible?: boolean;
}) {
  useDesignStyle(name, visible);
  return visible ? <span>{name}</span> : null;
}

test("the collector preserves validated hrefs, global sheets and configured cascade order", () => {
  const styles = new DesignStyleCollector(configured);
  styles.request("top-bar");
  styles.request("tag-chip");
  styles.request("tag-chip");
  assert.deepEqual(styles.stylesheets(), configured);
  assert.deepEqual(new DesignStyleCollector(configured).stylesheets(), [
    configured[0],
    configured[3],
  ]);
});

test("unconfigured style requests fail instead of inventing public URLs", () => {
  const styles = new DesignStyleCollector(configured);
  assert.throws(() => styles.request("inspector"), /not configured/);
});

test("nested render providers and hidden children cannot leak requested styles", () => {
  const outer = new DesignStyleCollector(configured);
  const inner = new DesignStyleCollector(configured);
  renderToStaticMarkup(
    <DesignStyles value={outer}>
      <Sample name="top-bar" />
      <DesignStyles value={inner}>
        <Sample name="tag-chip" />
      </DesignStyles>
      <Sample name="tag-chip" visible={false} />
    </DesignStyles>,
  );
  assert.deepEqual(outer.stylesheets(), [
    configured[0],
    configured[2],
    configured[3],
  ]);
  assert.deepEqual(inner.stylesheets(), [
    configured[0],
    configured[1],
    configured[3],
  ]);
});

test("overlapping invocations keep fresh independent style collections", async () => {
  const results = await Promise.all(
    (["tag-chip", "top-bar", "tag-chip"] as const).map(async (name) => {
      const styles = new DesignStyleCollector(configured);
      await Promise.resolve();
      renderToStaticMarkup(
        <DesignStyles value={styles}>
          <Sample name={name} />
        </DesignStyles>,
      );
      return styles.stylesheets();
    }),
  );
  assert.deepEqual(results, [
    [configured[0], configured[1], configured[3]],
    [configured[0], configured[2], configured[3]],
    [configured[0], configured[1], configured[3]],
  ]);
});
