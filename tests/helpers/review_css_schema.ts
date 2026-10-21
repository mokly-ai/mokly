import type {
  ReviewResult,
  ReviewView,
} from "../../packages/viewer/dist/review/types.js";

/**
 * Shared review v8 fixture: a material screen change whose mobile view keeps
 * two page-owned rules of a changed stylesheet, and whose desktop view keeps
 * only its excluded record.
 */
export function cssSchemaFixture(): ReviewResult {
  const address = { path: "auth", title: "Sign in", props: {} };
  const stylesheet = "static/shared.css";
  const views: ReviewView[] = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "changed",
      ignoredIds: [],
      rules: [".auth", ".button"].map((selector) => ({
        stylesheet,
        selector,
        status: "matched",
        owner: { kind: "entry" },
      })),
    },
    {
      viewport: "desktop",
      colorScheme: "light",
      state: "unchanged",
      ignoredIds: [],
      rules: [
        {
          stylesheet,
          selector: "",
          status: "excluded",
          owner: { kind: "entry" },
        },
      ],
    },
  ];
  return {
    schemaVersion: 8,
    baseCommit: "a".repeat(40),
    entries: [
      {
        kind: "screen",
        path: address.path,
        title: address.title,
        before: address,
        after: address,
        state: "changed",
        included: true,
        reasons: [
          { kind: "dependency", path: stylesheet },
          { kind: "material" },
        ],
        views,
      },
    ],
    affected: [],
    diagnostics: [],
  };
}
