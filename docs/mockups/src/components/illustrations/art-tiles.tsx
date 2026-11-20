/** Small visual explanations reused in the registered illustration's feature views. */
export function ArtTile({
  detail,
}: {
  detail: "screens" | "flow" | "changes";
}) {
  return (
    <div className={"art-tile art-" + detail} aria-hidden="true">
      {detail === "screens" && (
        <>
          <div className="mini-window">
            <span className="mini-heading" />
            <span />
            <span />
            <b />
          </div>
          <div className="mini-phone">
            <i />
            <span />
            <span />
            <b />
          </div>
        </>
      )}
      {detail === "flow" && (
        <div className="mini-flow">
          <span>Welcome</span>
          <i>→</i>
          <span>Your workspace</span>
          <i>→</i>
          <span>You’re in.</span>
        </div>
      )}
      {detail === "changes" && (
        <div className="mini-comparison">
          <div>
            <span>Before</span>
            <i />
          </div>
          <b>→</b>
          <div>
            <span>After</span>
            <i />
            <strong>✓</strong>
          </div>
        </div>
      )}
    </div>
  );
}
