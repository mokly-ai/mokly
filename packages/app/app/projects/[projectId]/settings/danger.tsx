import { useLocalSearchParams } from "expo-router";

import { ProjectPermalinkRoute } from "../../../../src/screens/app/permalink-route";

/** Resolve a project UUID delete-settings permalink before slug routes. */
export default function DangerSettingsPermalink() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectPermalinkRoute projectId={projectId} />;
}
