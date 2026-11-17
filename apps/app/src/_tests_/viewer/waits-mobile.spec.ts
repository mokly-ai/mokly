import {
  createProject,
  expect,
  freshEmail,
  open,
  projectPathFor,
  signIn,
  test,
} from "../harness";

import { holdReads, projectRead } from "./held-reads";

/**
 * The compact bar's wait. More carries the cloud's other controls on a phone,
 * so while the route reads the project, More keeps its label and waits,
 * disabled, beside the publication's placeholder.
 */

test("a compact bar keeps More, disabled, while the route reads the project", async ({
  page,
}) => {
  await signIn(page, freshEmail("viewer-waits-compact"));
  const projectId = await createProject(page, "Compact Waits Org");
  await open(page, await projectPathFor(page, projectId));
  await expect(page.getByTestId("viewer-more")).toBeEnabled();

  const project = await holdReads(page, projectRead);
  await page.reload();
  await project.arrived;
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveAccessibleName("Opening your project…");
  await expect(
    page.getByRole("button", { name: "More", exact: true }),
  ).toBeDisabled();
  project.release();
  await expect(page.getByTestId("viewer-more")).toBeEnabled();
});
