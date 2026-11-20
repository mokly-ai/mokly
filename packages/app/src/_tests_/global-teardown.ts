import {
  cleanupPublicationRuntime,
  stopApi,
  stopCatalogue,
} from "./api-server";
import { stopGitHubDouble } from "./github-double";

/** Stop exactly the servers this run started, by the pids it recorded. */
export default function globalTeardown(): void {
  stopCatalogue();
  stopApi();
  stopGitHubDouble();
  cleanupPublicationRuntime();
}
