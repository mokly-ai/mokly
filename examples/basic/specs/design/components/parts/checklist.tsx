/** Synthetic Checklist content for the tall comparison design, never product data. */
export const checklistTitle = "Before you begin";

/** Steps the saved Default variant marks complete, its `completed` prop. */
export const checklistCompleted = 3;

/**
 * Every step in order, as the Before version words them: enough fixed-height
 * rows to make the Checklist more than twice as tall as the shipped
 * component frame.
 */
const steps = [
  "Create your account",
  "Confirm your email",
  "Add your name",
  "Choose a photo",
  "Pick your interests",
  "Invite a friend",
  "Set your reminders",
  "Turn on notifications",
  "Review your privacy",
  "Start your first session",
  "Join a group",
  "Follow a topic",
  "Save a recipe",
  "Set a weekly goal",
  "Connect your calendar",
  "Choose a theme",
  "Add a backup email",
  "Turn on two-step sign-in",
  "Download the app",
  "Bookmark an article",
  "Share your progress",
  "Rate your first week",
  "Explore the library",
  "Finish your profile",
] as const;

/** The one step the Current version rewords, by its position in the list. */
const reworded = { index: 4, label: "Choose your topics" } as const;

/**
 * A component taller than its comparison frame. Every row has a fixed height
 * and never wraps, so the reworded step changes no other step's position.
 */
export function ChecklistExample({ before = false }: { before?: boolean }) {
  return (
    <div className="ce-checklist">
      <p className="ce-checklist-title">{checklistTitle}</p>
      <ol className="ce-checklist-steps">
        {steps.map((step, index) => {
          const complete = index < checklistCompleted;
          return (
            <li key={step} data-complete={complete ? "" : undefined}>
              <span
                className="ce-checklist-mark"
                role="img"
                aria-label={complete ? "Done" : "To do"}
              >
                {complete ? "✓" : null}
              </span>
              <span className="ce-checklist-label">
                {!before && index === reworded.index ? reworded.label : step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
