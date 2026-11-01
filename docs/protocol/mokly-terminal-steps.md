# CLI Comparison Steps

The [terminal output contract](./mokly-terminal-output.md#spinner-lifecycle)
owns the output modes, the width rules, and the spinner line.

## Comparison Steps

While Changes runs in `serve`, `build`, or `publish`, the animated
`Comparing with <base>` label names the step that runs now. A space, a `·`
separator, and a space join the label and the step:

```text
  ⠋ Comparing with origin/main · installing base dependencies
```

| Step       | Starts when                                         | Label text                     |
| ---------- | --------------------------------------------------- | ------------------------------ |
| Reading    | Changes begins to read the base commit.             | `reading base catalogue`       |
| Extracting | The source cache writes the base commit's files.    | `extracting base sources`      |
| Installing | The dependency cache installs the base packages.    | `installing base dependencies` |
| Rendering  | The base catalogue begins to render.                | `rendering base catalogue`     |
| Comparing  | Both sides are ready and the classification begins. | `finding changes`              |

A step stays on the label until the next step starts or Changes settles. A
complete source or dependency cache entry shows no step of its own, so the
label keeps the earlier step. Each step label replaces the earlier frame
immediately, and the timer keeps the step on later frames.

The step never reaches a durable line. `Changes ready` and
`Changes unavailable` keep their form and their duration. Plain mode and a
forced-rich pipe show no step, because neither animates the spinner. In
Serve, a step of a replaced comparison never changes the label of the
comparison that replaced it.

Decision: show the step on the one spinner line. Rejected: one durable line
for each step, because watched Serve compares again after each change, and the
repeated lines would fill the terminal.
