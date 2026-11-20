import { Switch } from "../../../entries/design/switch.mockup";
import { PendingName } from "../placeholders";

/**
 * Whether pushes publish themselves. The switch writes the setting on its
 * own, without the pane's Save, so it stays live while the pane saves a name:
 * two writes in one pane each keep their own control. A project that cannot
 * build has no switch to offer, so one sentence stands where it would be.
 *
 * While its own write runs, the switch shows the value the reader asked for,
 * disabled, with "Saving…" in its own row beside its label, because a switch
 * has no working word of its own; a screen reader hears the operation, and
 * nothing is inserted. While the read that decides its value runs, its label
 * stays and the switch waits as a placeholder in its own box.
 */
export function AutomaticBuilds({
  available,
  saving = false,
  waiting = false,
}: {
  available: boolean;
  /** The switch's own write is running: the reader turned builds off. */
  saving?: boolean;
  /** The read that decides the switch's value is running. */
  waiting?: boolean;
}) {
  if (!available)
    return <p className="fo-copy">This project publishes from CI.</p>;
  return (
    <div className="fo-setting">
      <Switch
        moklyInstance="project-automatic-builds"
        label="Automatic builds"
        {...(waiting
          ? { value: false, waiting: true }
          : saving
            ? { value: false, working: "Saving…" }
            : { value: true })}
      />
      {saving && <PendingName label="Saving automatic builds" hidden />}
      <p className="fo-copy">
        Publish each push to the default branch and to pull requests.
      </p>
    </div>
  );
}
