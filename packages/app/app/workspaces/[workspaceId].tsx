import { useLocalSearchParams } from "expo-router";

import { WorkspacePermalinkRoute } from "../../src/screens/app/permalink-route";

/** Resolve a workspace UUID permalink to its current slug. */
export default function WorkspacePermalink() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  return <WorkspacePermalinkRoute workspaceId={workspaceId} />;
}
