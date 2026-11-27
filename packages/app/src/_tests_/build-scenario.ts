import type { Page } from "@playwright/test";

import { buildPath, branchPath, pullRequestPath } from "../navigation/paths";

import { projectAddress } from "./addresses";
import type { ProjectAddress } from "./addresses";
import { buildDouble } from "./build-double";
import type { BuildDouble } from "./build-double";
import { routeBuilds } from "./build-routes";
import { freshEmail, signIn } from "./harness";
import { createProject } from "./project-setup";

/** One signed-in owner, their real project, and the double for its builds. */
export interface BuildScenario {
  projectId: string;
  address: ProjectAddress;
  double: BuildDouble;
  /** This project's build address. */
  buildAt: (id: string) => string;
  branchAt: (name: string) => string;
  pullAt: (number: number) => string;
}

/**
 * Sign a new owner in, create their project through the API with
 * `createProject`, and answer its build operations from a double, as a project
 * that can build.
 */
export async function buildScenario(
  page: Page,
  label: string,
  double: BuildDouble = buildDouble(),
): Promise<BuildScenario> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, label + " Org");
  const address = await projectAddress(page, projectId);
  await routeBuilds(page, projectId, double);
  const { workspaceSlug, slug } = address;
  return {
    projectId,
    address,
    double,
    buildAt: (id) => buildPath(workspaceSlug, slug, id),
    branchAt: (name) => branchPath(workspaceSlug, slug, name),
    pullAt: (number) => pullRequestPath(workspaceSlug, slug, number),
  };
}
