/** One closed disclosure for plain viewer diagnostics and an optional request reference. */
export function ErrorDetails({
  reference,
  details,
}: {
  reference?: string;
  details?: string;
}) {
  if (!reference && !details) return null;
  return (
    <details className="fo-error-details">
      <summary>Details</summary>
      {details && <p className="fo-note-detail">{details}</p>}
      {reference && (
        <p className="fo-note-detail">
          Reference <code className="mono-value">{reference}</code>
        </p>
      )}
    </details>
  );
}
