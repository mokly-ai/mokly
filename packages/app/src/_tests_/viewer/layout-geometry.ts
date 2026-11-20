import type { Locator } from "@playwright/test";

import { expect } from "../harness";

/** The distance between the vertical centres of two rendered controls. */
export async function verticalCentreDifference(
  first: Locator,
  second: Locator,
): Promise<number | null> {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
  ]);
  if (firstBox === null || secondBox === null) return null;
  return Math.abs(
    firstBox.y + firstBox.height / 2 - secondBox.y - secondBox.height / 2,
  );
}

/** Read visible controls, including whichever cloud composition is present. */
export async function expectReadableBar(viewer: Locator) {
  const search = viewer.getByRole("searchbox", { name: "Search catalogue" });
  const tag = viewer.getByRole("button", { name: "Filter by tag" });
  await expect(search).toBeVisible();
  await expect(tag).toBeVisible();
  await expect(viewer.getByTestId("viewer-publication")).toBeVisible();
  const controls = search
    .or(tag)
    .or(
      viewer.getByTestId(
        /^viewer-(project|publication|history|share|settings|account|more)$/,
      ),
    )
    .filter({ visible: true });

  await expect
    .poll(async () => {
      const boundary = await viewer.boundingBox();
      if (boundary === null) return ["the viewer is missing"];
      return controls.evaluateAll((elements, bounds) => {
        const issues: string[] = [];
        const boxes = elements.map((element) => ({
          element,
          name:
            element.getAttribute("aria-label") ?? element.textContent?.trim(),
          rect: element.getBoundingClientRect(),
        }));
        for (const { element, name, rect } of boxes) {
          if (rect.left < bounds.x || rect.right > bounds.x + bounds.width) {
            issues.push(`${name} extends outside the viewer`);
          }
          // Check actual clipping by a host slot, not a class or a CSS value.
          for (
            let owner = element.parentElement;
            owner;
            owner = owner.parentElement
          ) {
            const style = getComputedStyle(owner);
            const clip = owner.getBoundingClientRect();
            if (
              ["hidden", "clip", "auto", "scroll"].includes(style.overflowX) &&
              (rect.left < clip.left || rect.right > clip.right)
            ) {
              issues.push(`${name} is clipped by its container`);
              break;
            }
          }
          if (element instanceof HTMLInputElement) {
            const style = getComputedStyle(element);
            const context = document.createElement("canvas").getContext("2d");
            if (context === null) {
              issues.push("the search text could not be measured");
              continue;
            }
            context.font = style.font;
            const textWidth = Math.ceil(
              context.measureText(element.placeholder).width,
            );
            const usableWidth =
              element.clientWidth -
              parseFloat(style.paddingLeft) -
              parseFloat(style.paddingRight);
            if (usableWidth < textWidth) {
              issues.push(
                `${name} has ${usableWidth}px for its ${textWidth}px placeholder`,
              );
            }
          }
        }
        for (const [index, left] of boxes.entries()) {
          for (const right of boxes.slice(index + 1)) {
            if (
              left.rect.left < right.rect.right &&
              right.rect.left < left.rect.right &&
              left.rect.top < right.rect.bottom &&
              right.rect.top < left.rect.bottom
            ) {
              issues.push(`${left.name} overlaps ${right.name}`);
            }
          }
        }
        return issues;
      }, boundary);
    }, "the package search and cloud controls remain readable without overlap")
    .toEqual([]);
}
