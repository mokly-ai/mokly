/**
 * The status of a render of edited props, over the preview and outside its
 * busy region. It stays present while nothing renders, so that a render in
 * flight is announced when its text appears.
 */

/** The status: a pending dot and the status text while a render runs. */
export function EditStatus({
  status,
}: {
  /** The status of a render in flight, such as "Updating preview…". */
  status?: string | undefined;
}) {
  return (
    <p className="mbk-edit-status mbk-reset" role="status">
      {status !== undefined ? (
        <>
          <span aria-hidden="true" className="mbk-pending-dot mbk-reset" />
          {status}
        </>
      ) : null}
    </p>
  );
}
