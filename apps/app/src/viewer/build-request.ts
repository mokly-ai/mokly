import { useRouter } from "expo-router";
import { useCallback } from "react";

import type { Project } from "../api/types";
import { requestBuild } from "../data/builds";
import type { PublicationRef } from "../data/publications";
import { nothingToDo, useWrite } from "../settings/write";
import type { Write } from "../settings/write";

import { requestTarget } from "./build-target";

/**
 * Publish one reference's current head from the control that asks to. The
 * control's own write reports a refusal beside it; an answer that names a
 * build or a publication opens it.
 */
export function useBuildRequest(
  project: Project,
  ref: PublicationRef | undefined,
): { write: Write; send: () => void } {
  const router = useRouter();
  const write = useWrite(nothingToDo, ref !== undefined);
  const { run } = write;
  const send = useCallback(() => {
    if (ref === undefined) return;
    void run(async () => {
      router.push(await requestTarget(project, ref, requestBuild));
    });
  }, [project, ref, router, run]);
  return { write, send };
}
