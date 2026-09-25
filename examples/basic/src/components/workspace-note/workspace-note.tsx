import styles from "./workspace-note.module.css";
import "./workspace-note.css";
import "./utilities.css";

/** A small getting-started note for the example workspace screen. */
export function WorkspaceNote() {
  return (
    <aside aria-label="Workspace tip" className={styles.note}>
      <span aria-hidden="true" className="example-workspace-note-mark" />
      <div className={styles.copy}>
        <strong className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold note-title">
          Make room for your ideas
        </strong>
        <span>Name your workspace to get started.</span>
      </div>
    </aside>
  );
}
