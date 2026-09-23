import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { errorMessage } from "./evidence_contract.mjs";

const defaultExecute = promisify(execFile);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export function createEvidenceGithub({
  token,
  repository,
  serverUrl,
  fetch: fetchImpl = globalThis.fetch,
  execute = defaultExecute,
  write = writeFile,
}) {
  const apiRoot = githubApiRoot(serverUrl);
  const repositoryPath = repository
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  async function requestJson(route) {
    const url = `${apiRoot}/repos/${repositoryPath}/${route}`;
    try {
      const response = await fetchImpl(url, {
        headers: apiHeaders(token),
      });
      if (!response.ok)
        return absent(`GitHub GET ${route} returned ${response.status}`);
      const value = await response.json();
      if (response.headers.get("link")?.includes('rel="next"'))
        return absent(`GitHub GET ${route} exceeded the bounded listing`);
      return { outcome: "applicable", value };
    } catch (error) {
      return absent(`GitHub GET ${route} failed: ${errorMessage(error)}`);
    }
  }

  async function requestListing(route, field) {
    const result = await requestJson(withPageSize(route));
    if (result.outcome !== "applicable") return result;
    const values = field ? result.value?.[field] : result.value;
    if (!Array.isArray(values))
      return absent(`GitHub GET ${route} returned an invalid listing`);
    if (
      field &&
      Number.isFinite(result.value?.total_count) &&
      result.value.total_count > values.length
    )
      return absent(`GitHub GET ${route} exceeded the bounded listing`);
    return { outcome: "applicable", value: values };
  }

  return {
    listPulls: (commit) => requestListing(`commits/${commit}/pulls`),
    listRuns: (event, headSha) =>
      requestListing(
        `actions/workflows/ci.yml/runs?event=${encodeURIComponent(event)}&head_sha=${encodeURIComponent(headSha)}&status=success`,
        "workflow_runs",
      ),
    listJobs: (runId) => requestListing(`actions/runs/${runId}/jobs`, "jobs"),
    listArtifacts: (runId) =>
      requestListing(`actions/runs/${runId}/artifacts`, "artifacts"),
    async readCommitTree(commit) {
      const result = await requestJson(`git/commits/${commit}`);
      if (result.outcome !== "applicable") return result;
      const tree = result.value?.tree?.sha;
      if (typeof tree !== "string" || !/^[a-f0-9]{40}$/.test(tree))
        return absent(`GitHub commit ${commit} has no valid tree`);
      return { outcome: "applicable", value: tree };
    },
    async downloadArtifact(artifact, destination) {
      if (!safeArtifact(artifact))
        return invalid("verification artifact has an unsafe name or id");
      const route = `actions/artifacts/${artifact.id}/zip`;
      const apiUrl = `${apiRoot}/repos/${repositoryPath}/${route}`;
      let redirect;
      try {
        redirect = await fetchImpl(apiUrl, {
          headers: apiHeaders(token),
          redirect: "manual",
        });
      } catch (error) {
        return absent(`GitHub GET ${route} failed: ${errorMessage(error)}`);
      }
      if (!REDIRECTS.has(redirect.status))
        return absent(`GitHub GET ${route} returned ${redirect.status}`);
      const location = redirect.headers.get("location");
      if (!location) return absent(`GitHub GET ${route} omitted its redirect`);
      let archive;
      try {
        const response = await fetchImpl(new URL(location, apiUrl), {
          redirect: "follow",
        });
        if (!response.ok)
          return absent(`artifact blob download returned ${response.status}`);
        archive = new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        return absent(`artifact blob download failed: ${errorMessage(error)}`);
      }
      const archivePath = path.join(
        path.dirname(destination),
        `${artifact.id}.zip`,
      );
      try {
        await write(archivePath, archive);
        await execute("unzip", ["-o", "-q", archivePath, "-d", destination]);
      } catch (error) {
        return invalid(`artifact extraction failed: ${errorMessage(error)}`);
      }
      return { outcome: "applicable" };
    },
  };
}

export function githubApiRoot(serverUrl) {
  const normalized = serverUrl.replace(/\/$/, "");
  return normalized === "https://github.com"
    ? "https://api.github.com"
    : `${normalized}/api/v3`;
}

function withPageSize(route) {
  return `${route}${route.includes("?") ? "&" : "?"}per_page=100`;
}

function apiHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function safeArtifact(artifact) {
  return (
    Number.isSafeInteger(artifact.id) &&
    artifact.id > 0 &&
    typeof artifact.name === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(artifact.name) &&
    artifact.name !== "." &&
    artifact.name !== ".."
  );
}

async function writeFile(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}

function absent(reason) {
  return { outcome: "absent", reason };
}

function invalid(reason) {
  return { outcome: "invalid", reason };
}
