/**
 * The developer's half of a failure. The reader already has the outcome and
 * the way back above; this collapsed disclosure carries the reference a
 * support report needs, so the headline never has to. A failure raised in the
 * browser rather than answered by Mokly draws none, because a reference that
 * correlates with nothing is worse than no reference.
 */
import { ErrorDetails } from "./error-details";

export function ErrorReference({ reference }: { reference: string }) {
  return <ErrorDetails reference={reference} />;
}
