import type { Session } from "../../api/types";

export function session(githubConnected: boolean, csrfToken = "csrf"): Session {
  return {
    user: {
      id: "01994f10-0000-7000-8000-000000000011",
      name: "person@example.com",
      email: "person@example.com",
      githubConnected,
    },
    csrfToken,
    workspaceIds: [],
  };
}
