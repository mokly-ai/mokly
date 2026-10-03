import assert from "node:assert/strict";
import test from "node:test";

import { pathFixture } from "./helpers/path_fixture.js";

const rejected = [
  ...[
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "svg",
    "math",
    "form",
    "video",
  ].map((tag) => [
    `<${tag}>unsafe</${tag}>`,
    `element <${tag}> is not allowed`,
  ]),
  ['<p onclick="alert(1)">Text</p>', "attribute onclick on <p> is not allowed"],
  ['<p style="color:red">Text</p>', "attribute style on <p> is not allowed"],
  [
    '<img src="https://example.com/x.png" onerror="alert(1)">',
    "attribute onerror on <img> is not allowed",
  ],
  [
    '<a href="javascript:alert(1)">Text</a>',
    "href on <a> is not an allowed URL",
  ],
  [
    '<a href="java&#10;script:alert(1)">Text</a>',
    "href on <a> is not an allowed URL",
  ],
  [
    '<img src="data:image/svg+xml,unsafe">',
    "src on <img> is not an allowed URL",
  ],
  [
    '<a href="file:///etc/passwd">Text</a>',
    "href on <a> is not an allowed URL",
  ],
  ['<input type="text" disabled>', "attribute type on <input> is not allowed"],
  ['<input type="checkbox">', "<input> must be disabled"],
  ["<input disabled>", "<input> must have checkbox type"],
  ['<p class="arbitrary">Text</p>', "attribute class on <p> is not allowed"],
] as const;

for (const [markup, reason] of rejected)
  test(`the final document allowlist rejects ${markup}`, async (t) => {
    const fixture = await pathFixture(
      {
        "specs/guide.md": "# Guide",
        "transform.ts": `export default ({content}) => content.replace('</main>', ${JSON.stringify(markup)} + '</main>');`,
      },
      '{mockupsDir:"generated",roots:[{dir:"specs"}],compatibility:{transformer:"transform.ts"}}',
    );
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `specs/guide.md: unsafe rendered document: ${reason}`,
    });
  });

test("the final allowlist also rejects event attributes merged onto the document root", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/guide.md": "# Guide",
      "transform.ts": `export default ({content}) => content.replace('</main>', '<html onclick="alert(1)"></main>');`,
    },
    '{mockupsDir:"generated",roots:[{dir:"specs"}],compatibility:{transformer:"transform.ts"}}',
  );
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), {
    code: "build-invalid",
    detail:
      "specs/guide.md: unsafe rendered document: attribute onclick on <html> is not allowed",
  });
});

test("the allowlist accepts the complete CommonMark and GFM output in both schemes", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/guide.md":
        '# Guide\n\nA **strong**, *emphasized*, ~~deleted~~ and `coded` word.\n\n> A quote\n\n3. Third\n4. Fourth\n\n- [x] Done\n- [ ] Pending\n\n| Left | Centre | Right |\n| :--- | :---: | ---: |\n| A | B | C |\n\n```ts\nconst x = 1;\n```\n\n---\n\n[Site](https://example.com "A title")\n\n![Image](https://example.com/image.png "A picture")',
    },
    '{mockupsDir:"generated",roots:[{dir:"specs"}],colorSchemes:["light","dark"]}',
  );
  t.after(fixture.remove);
  const { outputs } = await fixture.compile();
  assert.ok(outputs.has("guide/index.html"));
  assert.ok(outputs.has("guide/index.dark.html"));
});
