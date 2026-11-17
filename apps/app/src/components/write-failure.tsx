import type { ReactNode } from "react";

import type { ApiError } from "../api/errors";
import { ErrorDetails } from "./error-details";

/**
 * The registered `write-failure` fragment, and the only composition a refused
 * write draws: the cause as one line immediately above the control that made
 * the write, the control itself as the way back, and the reference Mokly
 * answered with in a `Details` disclosure beneath it.
 *
 * It is returned as one node rather than offered as three pieces, because six
 * controls assembled those pieces for themselves and four of them put the cause
 * below the control instead. The decision to draw the fragment is made here
 * rather than at every call site.
 *
 * The node is the same element at rest, refused and while a retry works, so a
 * refusal that appears or goes never replaces the control inside it: the
 * control keeps its place in the tree, and with it the reader's focus. At rest
 * that element draws no box, so a surface with nothing to report lays its
 * control out as if nothing stood around it.
 *
 * A failure raised in the browser rather than answered by Mokly — a clipboard
 * that refused the revealed token — passes no error, so it draws no disclosure:
 * a reference that correlates with nothing is worse than no reference.
 */
export function writeFailure(
  cause: string | undefined,
  error: ApiError | undefined,
  control: ReactNode,
): ReactNode {
  const refused = cause !== undefined || error !== undefined;
  return (
    <div className={refused ? "fo-write-failure" : "fo-write-frame"}>
      {cause !== undefined && (
        <p className="fo-copy" role="alert">
          {cause}
        </p>
      )}
      {control}
      {error && <ErrorDetails reference={error.requestId} />}
    </div>
  );
}
