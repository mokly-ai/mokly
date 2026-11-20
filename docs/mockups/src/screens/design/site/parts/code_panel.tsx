/** The Folio code panel with its language label and copy control. */
export function CodePanel({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  return (
    <div className="site-code">
      <div className="site-code-head">
        <span className="site-code-language">{language}</span>
        <button className="site-code-copy" type="button">
          Copy
        </button>
      </div>
      <pre className="site-code-body">
        <code>{code}</code>
      </pre>
    </div>
  );
}
