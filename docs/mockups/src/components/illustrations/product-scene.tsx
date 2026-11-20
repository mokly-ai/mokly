import { CommentThread } from "../../entries/design/comment-thread.mockup";

/** Fictional design material contained entirely in the registered illustration. */
export function ProductScene({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={"product-scene" + (compact ? " product-scene-compact" : "")}
    >
      <div className="scene-brand">
        <span aria-hidden="true">◉</span> Monday{" "}
        <span className="scene-avatar">AL</span>
      </div>
      <div className="scene-content">
        <span className="scene-breadcrumb">Workspace / Website launch</span>
        <div className="scene-title">
          <div>
            <span className="scene-kicker">YOUR NEXT GOOD IDEA</span>
            <strong>Website launch.</strong>
          </div>
          <span className="scene-action">+ New task</span>
        </div>
        <p>A little focus. A lot of forward.</p>
        <div className="scene-tabs">
          <span>Overview</span>
          <span>Tasks</span>
          <span>Files</span>
        </div>
        <div className="scene-progress">
          <strong>Let’s make it happen.</strong>
          <p>Keep the good work moving.</p>
          <div className="scene-track">
            <span />
          </div>
          <span className="scene-team">
            AL · JD · SK <span>Made for working together.</span>
          </span>
        </div>
        <div className="scene-list">
          <strong>Up next</strong>
          {[
            "Find our direction",
            "Make the first impression",
            "Bring it all together",
          ].map((text, i) => (
            <div key={text}>
              <span className={i === 0 ? "task-done" : ""}>
                {i === 0 ? "✓" : "○"}
              </span>
              {text}
              <span className="task-state">
                {i === 0 ? "Done" : i === 1 ? "In progress" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BrowserScene() {
  return (
    <div className="illustration-browser">
      <div className="browser-toolbar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Our product / Website launch</span>
        <span>↗</span>
      </div>
      <div className="browser-canvas">
        <span className="canvas-label">
          DESKTOP <span>Your components. One product.</span>
        </span>
        <ProductScene />
      </div>
    </div>
  );
}

export function ReviewPanel() {
  return (
    <div className="review-panel">
      <div className="panel-toolbar">
        <strong>Website launch</strong>
        <span>Screen review</span>
        <span className="panel-branch">↳ A clearer next step</span>
      </div>
      <div className="panel-columns">
        <aside className="panel-sidebar">
          <span className="scene-kicker">THE PICTURE</span>
          <span className="panel-selected">▦ Overview</span>
          <span>▯ Mobile</span>
          <span>▭ Desktop</span>
          <span className="scene-kicker">BUILDING BLOCKS</span>
          <span className="panel-chip">Button</span>
          <span className="panel-chip">Task list</span>
          <span className="panel-chip">Page header</span>
        </aside>
        <div className="panel-stage">
          <ProductScene />
          <span className="panel-caption">
            Your components. The whole screen.
          </span>
        </div>
        <aside className="panel-discussion">
          <span className="scene-kicker">THE CONVERSATION</span>
          <CommentThread
            moklyInstance="illustrated-review"
            author="Alex"
            text="Could we put the next action beside the page title?"
            replies={[
              { author: "Sam", text: "Moved it into view. Ready to build." },
            ]}
            resolved={true}
          />
          <div className="discussion-note">
            A clearer next step.
            <br />
            <em>A shared decision.</em>
          </div>
        </aside>
      </div>
    </div>
  );
}
