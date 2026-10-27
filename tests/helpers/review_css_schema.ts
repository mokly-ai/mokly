import type {
  ComparedEntry,
  ReviewView,
} from "../../packages/viewer/dist/review/types.js";

/**
 * Shared compared-entry fixture: a material screen change whose mobile view
 * keeps two page-owned rules of a changed stylesheet, and whose desktop view
 * keeps only its excluded record.
 */
export function cssSchemaFixture(): ComparedEntry & { views: ReviewView[] } {
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
    path: "auth",
    basePath: "auth",
    reasons: [{ kind: "dependency", path: stylesheet }, { kind: "material" }],
    views,
  };
}
