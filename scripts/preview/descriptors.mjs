/** Build removed-entry descriptors from one complete packaged generation. */
export function publicationPreviewDescriptors(
  removed,
  pages,
  directory,
  result,
) {
  return new Map(
    removed.flatMap(({ entry }) => {
      if (entry.kind === "screen") {
        const screen = result.screens.find(
          (candidate) => candidate.route === entry.route,
        );
        if (
          !screen ||
          screen.state !== "removed" ||
          screen.views.length === 0 ||
          screen.views.some((view) => !view.beforePath || view.afterPath)
        )
          throw new Error(
            `removed screen preview is incomplete: ${entry.route}`,
          );
        return [[entry.route, { kind: "screen" }]];
      }
      if (entry.kind === "page") {
        if (!pages.has(entry.route))
          throw new Error(`removed page preview is missing: ${entry.route}`);
        return [
          [
            entry.route,
            {
              kind: "page",
              path: `${directory}/pages/${entry.route}.json`,
            },
          ],
        ];
      }
      return [];
    }),
  );
}
