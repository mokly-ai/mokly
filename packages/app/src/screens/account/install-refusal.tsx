import type { ApiError } from "../../api/errors";
import { ErrorDetails } from "../../components/error-details";
import { StateMessage } from "../../components/page-parts";

/**
 * What a refused installation start means to the reader. GitHub that has not
 * opened for this deployment yet is said once, in the title: no retry helps,
 * so the step invents no retry time. Every other refusal reads as the trip not
 * starting, and says nothing further: the control beneath it already reads
 * the way back.
 */
function refusalTitle(error: ApiError): string {
  return error.reason === "operation-unavailable"
    ? "App installation opens soon"
    : "Installation was cancelled";
}

/**
 * A refused installation start, on the install step and on the connect
 * situation alike, because both send the same request. Each refusal means
 * something different to the reader, so the step names it as its own state
 * body rather than pointing at the control with it, and that body carries the
 * reference.
 */
export function InstallRefusal({ error }: { error: ApiError }) {
  return (
    <StateMessage
      title={refusalTitle(error)}
      error
      details={<ErrorDetails reference={error.requestId} />}
      testID="install-refusal"
    />
  );
}
