import { MoklyError, type MoklyErrorCode } from "../errors.js";

const REJECTIONS: Readonly<Record<number, readonly [MoklyErrorCode, string]>> =
  {
    400: [
      "upload-invalid-bundle",
      "The service rejected the catalogue data. Rebuild the export and retry.",
    ],
    422: [
      "upload-invalid-bundle",
      "The service rejected the catalogue data. Rebuild the export and retry.",
    ],
    401: [
      "upload-unauthorized",
      "The service denied the upload. Check the token and repository access.",
    ],
    403: [
      "upload-unauthorized",
      "The service denied the upload. Check the token and repository access.",
    ],
    413: [
      "upload-too-large",
      "The catalogue exceeds an upload limit. Reduce the catalogue or its assets.",
    ],
    426: [
      "upload-unsupported-version",
      "The service does not support this upload version. Update Mokly or the receiver.",
    ],
  };

/** Typed cancellation preserving the public upload-failed category. */
export class PublishCancelledError extends MoklyError {
  constructor() {
    super(
      "upload-failed",
      "Publication was cancelled. Run mokly publish again when you are ready.",
      { presentation: "publish-cancelled" },
    );
    this.name = "PublishCancelledError";
  }
}

/** Fixed cancellation raised only for an aborted publish command. */
export function publishCancelled(): PublishCancelledError {
  return new PublishCancelledError();
}

/** Fixed failure after retry exhaustion or a transport-layer interruption. */
export function uploadTransportFailed(): MoklyError {
  return new MoklyError(
    "upload-failed",
    "The catalogue upload did not complete. Check the endpoint and connection, then retry.",
    { presentation: "publish-transport-failed" },
  );
}

/** Fixed generic failure for an invalid or rejected exchange outcome. */
export function uploadFailed(
  message = "The catalogue could not be uploaded. Check the endpoint and connection, then retry.",
): MoklyError {
  return new MoklyError("upload-failed", message);
}

/** Fixed local or remote rejection for invalid publication data. */
export function invalidBundle(message: string): MoklyError {
  return new MoklyError("upload-invalid-bundle", message);
}

/** Fixed local rejection for publication data that exceeds a limit. */
export function uploadTooLarge(message: string): MoklyError {
  return new MoklyError("upload-too-large", message);
}

/** Fixed local rejection for an unsupported publication contract version. */
export function unsupportedUploadVersion(message: string): MoklyError {
  return new MoklyError("upload-unsupported-version", message);
}

/** Fixed invalid-command rejection for publish transport options. */
export function invalidPublishOption(message: string): MoklyError {
  return new MoklyError("cli-invalid", message);
}

/** Fixed Git identity failure for publication preparation. */
export function publishIdentityFailed(message: string): MoklyError {
  return new MoklyError("git-failed", message);
}

/** Map a terminal HTTP status to its stable public category and copy. */
export function statusError(status: number): MoklyError {
  const [code, message] = REJECTIONS[status] ?? [
    "upload-failed",
    "The service did not accept the upload. Check the endpoint and retry.",
  ];
  return new MoklyError(code, message);
}
