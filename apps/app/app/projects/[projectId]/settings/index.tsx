import { useLocalSearchParams } from "expo-router";

import { ProjectPermalinkRoute } from "../../../../src/screens/app/permalink-route";

/** Resolve a project UUID settings permalink before slug settings routes. */
export default function ProjectSettingsPermalink() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectPermalinkRoute projectId={projectId} />;
}
