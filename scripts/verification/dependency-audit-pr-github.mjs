const BRANCH = "dependency-audit/main";
const LABEL = "dependency-audit";

/** Compose repository REST operations over an injected fetch without logging headers. */
export function createPrGitHub(configuration, fetch) {
  const root = `/repos/${configuration.repository}`;
  const headers = {
    Authorization: `Bearer ${configuration.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mokly-dependency-audit",
    "Content-Type": "application/json",
  };
  const failure = (method, path, status, data) =>
    new Error(
      `GitHub ${method} ${path} failed (${status}): ${data?.message ?? "no response message"}. Check repository permissions and API access, then retry.`,
    );
  const request = async (method, path, body, allowed = []) => {
    let response;
    try {
      response = await fetch(`${configuration.apiUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (cause) {
      throw new Error(
        `GitHub ${method} ${path} could not connect. Restore API access and retry.`,
        { cause },
      );
    }
    let data;
    try {
      data = response.status === 204 ? undefined : await response.json();
    } catch {
      throw failure(method, path, response.status, {
        message: "invalid JSON response",
      });
    }
    if (!response.ok && !allowed.includes(response.status))
      throw failure(method, path, response.status, data);
    return { data, response };
  };
  return {
    async openPullRequests() {
      const pulls = [];
      let path = `${root}/pulls?state=open&head=${configuration.owner}:${BRANCH}`;
      while (path) {
        const { data, response } = await request("GET", path);
        if (!Array.isArray(data))
          throw new Error(
            "GitHub pull request list is invalid. Restore API access and retry.",
          );
        for (const pull of data)
          if (
            pull.state === "open" &&
            pull.head?.ref === BRANCH &&
            pull.head?.repo?.full_name === configuration.repository
          ) {
            if (!Number.isSafeInteger(pull.number) || pull.number < 1)
              throw new Error(
                "GitHub pull request number is invalid. Check API output and retry.",
              );
            pulls.push(pull);
          }
        const next = response.headers
          .get("link")
          ?.match(/<([^>]+)>;\s*rel="next"/u)?.[1];
        path = "";
        if (next) {
          const url = new URL(next);
          const base = new URL(configuration.apiUrl);
          const basePath = base.pathname.replace(/\/$/u, "");
          const nextPath = url.pathname.slice(basePath.length);
          if (
            url.origin !== base.origin ||
            !url.pathname.startsWith(`${basePath}/`) ||
            (nextPath !== `${root}/pulls` &&
              !/^\/repositories\/\d+\/pulls$/u.test(nextPath))
          )
            throw new Error(
              "GitHub pagination URL is invalid. Check API output and retry.",
            );
          path = `${nextPath}${url.search}`;
        }
      }
      return pulls;
    },
    async ensureLabel() {
      const { response } = await request(
        "GET",
        `${root}/labels/${LABEL}`,
        undefined,
        [404],
      );
      if (response.status !== 404) return;
      const path = `${root}/labels`;
      const created = await request(
        "POST",
        path,
        {
          name: LABEL,
          color: "0366d6",
          description: "Strict dependency audit findings",
        },
        [422],
      );
      if (
        created.response.status === 422 &&
        !(
          Array.isArray(created.data?.errors) &&
          created.data.errors.some((error) => error?.code === "already_exists")
        ) &&
        !/already exists/iu.test(created.data?.message ?? "")
      )
        throw failure("POST", path, 422, created.data);
    },
    async createPullRequest(body) {
      const { data } = await request("POST", `${root}/pulls`, {
        title: "fix(deps): resolve dependency audit findings",
        head: BRANCH,
        base: "main",
        body,
      });
      if (!Number.isSafeInteger(data?.number) || data.number < 1)
        throw new Error(
          "GitHub created pull request has no valid number. Check repository pull requests and retry.",
        );
      return data.number;
    },
    async labelPullRequest(number) {
      await request("POST", `${root}/issues/${number}/labels`, {
        labels: [LABEL],
      });
    },
    async replaceBody(number, body) {
      await request("PATCH", `${root}/pulls/${number}`, { body });
    },
    async closePullRequest(number) {
      await request("POST", `${root}/issues/${number}/comments`, {
        body: `The strict dependency audit of main passed. [Clean audit run](${configuration.runUrl}). Closing this update pull request.`,
      });
      await request("PATCH", `${root}/pulls/${number}`, { state: "closed" });
    },
  };
}
