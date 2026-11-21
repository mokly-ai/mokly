import { useLocalSearchParams } from "expo-router";

import { NewProjectRoute } from "../../../src/screens/app/new-project-route";

/** Choose an installed repository for a new project. */
export default function NewProject() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <NewProjectRoute workspaceSlug={workspace} />;
}
