import { useLocalSearchParams } from "expo-router";

import { CliProjectRoute } from "../../../../src/screens/app/cli-project-route";

/** Create a project that publishes with the Mokly CLI. */
export default function NewCliProject() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <CliProjectRoute workspaceSlug={workspace} />;
}
