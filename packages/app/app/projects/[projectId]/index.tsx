import { useLocalSearchParams } from "expo-router";

import { ProjectPermalinkRoute } from "../../../src/screens/app/permalink-route";

/** Resolve an exact project UUID permalink to current slugs. */
export default function ProjectPermalink() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectPermalinkRoute projectId={projectId} />;
}
