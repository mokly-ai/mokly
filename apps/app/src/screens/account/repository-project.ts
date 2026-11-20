import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { unexpectedError } from "../../api/errors";
import type { Repository } from "../../api/types";
import { createProject, suggestProjectSlug } from "../../data/projects";
import { useSuggestedSlug } from "../../data/use-slug-suggestion";
import { projectSetupPath } from "../../navigation/paths";
import { useWrite } from "../../settings/write";

import { projectName } from "./project-name";

/**
 * The project the repository step creates from the chosen repository: the
 * address suggested for it from the repository and the config path, and the
 * one write that creates it and opens the finished project. A refusal belongs
 * to the address it was made for, so changing the slug takes it away.
 */
export function useRepositoryProject(
  workspaceId: string,
  chosen: Repository | undefined,
  configPath: string,
) {
  const router = useRouter();
  const suggestionSource =
    chosen !== undefined && configPath.length > 0
      ? `${workspaceId}\n${chosen.fullName}\n${configPath}`
      : "";
  const chosenName = chosen?.fullName ?? "";
  const loadSuggestion = useCallback(
    () =>
      suggestProjectSlug(workspaceId, {
        repository: chosenName,
        configPath,
      }),
    [workspaceId, chosenName, configPath],
  );
  const suggestion = useSuggestedSlug(suggestionSource, loadSuggestion);
  const slug = suggestion.value;
  // The project the setup step is addressed by, which only the answer knows.
  // Opening it is the write's `done`, so a step that cannot be opened is never
  // reported as a request that failed.
  const created = useRef("");
  const attemptedSlug = useRef("");
  const openSetup = useCallback(() => {
    router.replace(created.current);
  }, [router]);
  const write = useWrite(
    openSetup,
    chosen !== undefined && configPath.length > 0 && slug.length > 0,
  );
  useEffect(() => {
    if (write.error && attemptedSlug.current !== slug) write.clearError();
  }, [slug, write]);

  const submit = useCallback(
    () =>
      write.run(async () => {
        if (chosen === undefined) throw unexpectedError();
        attemptedSlug.current = slug;
        const project = await createProject(workspaceId, {
          name: projectName(chosen.fullName),
          slug,
          configPath,
          repositoryId: chosen.id,
        });
        created.current = projectSetupPath(project.workspaceSlug, project.slug);
      }),
    [write, workspaceId, chosen, configPath, slug],
  );
  return { suggestion, write, submit };
}
