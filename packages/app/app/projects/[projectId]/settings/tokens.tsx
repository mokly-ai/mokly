import { useLocalSearchParams } from "expo-router";

import { ProjectPermalinkRoute } from "../../../../src/screens/app/permalink-route";

/** Resolve a project UUID publishing-token permalink before slug routes. */
export default function TokenSettingsPermalink() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectPermalinkRoute projectId={projectId} />;
}
