import { useLocalSearchParams } from "expo-router";

import { ProjectPermalinkRoute } from "../../../src/screens/app/permalink-route";

/** Resolve a project UUID permalink with any tail/query to current slugs. */
export default function ProjectPermalinkTail() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectPermalinkRoute projectId={projectId} />;
}
