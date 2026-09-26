/** Public repository identity asserted by the uploader and authorized by a receiver. */
export interface UploadRepository {
  host: string;
  owner: string;
  name: string;
}

/** Upload envelope v1, documented independently of internal module paths. */
export interface UploadManifest {
  schemaVersion: 1;
  moklyVersion: string;
  repository: UploadRepository;
  branch: string;
  headSha: string;
  baseRef: string | null;
  baseSha: string | null;
  pullRequest: number | null;
  configPath: string;
  exportedAt: string;
  comparisonPath: string | null;
}

/** Git context pinned before export. */
export interface UploadIdentity {
  repository: UploadRepository;
  branch: string;
  headSha: string;
  pullRequest: number | null;
  gitRoot: string;
}

/** Validated transport configuration; never format this object in diagnostics. */
export interface UploadOptions {
  endpoint: string;
  token: string;
}

/** Validated response from the upload plan request. */
export interface PlanResponse {
  schemaVersion: 1;
  upload: {
    id: string;
    expiresAt: string;
  };
  missing: string[];
  blobUrl: string;
  completeUrl: string;
}

/** Completed publication counts and optional receiver destination. */
export interface PublishResult {
  outcome: "published" | "already-published";
  uploaded: number;
  unchanged: number;
  viewerUrl: string | null;
}
