import { useLocalSearchParams } from "expo-router";

import { ProjectPermalinkRoute } from "../../../../src/screens/app/permalink-route";

/** Resolve a project UUID access-settings permalink before slug routes. */
export default function AccessSettingsPermalink() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectPermalinkRoute projectId={projectId} />;
}
