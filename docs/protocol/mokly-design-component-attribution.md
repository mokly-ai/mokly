# Design Component Attribution

Continuation of [design component adoption](./mokly-design-components.md).

## Delivery Status

Uniform CSS attribution is implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match).
The implementation and caller-input rules are already implemented.

## Acceptance

Acceptance after a registered baseline exists:

| Edit                                                           | Direct Changes                                                                                                    | Secondary evidence                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Top bar implementation                                         | Top bar                                                                                                           | Consuming design screens                  |
| Nested Tag chip implementation                                 | Tag chip                                                                                                          | Picker/Top bar and their screen consumers |
| A screen changes query, title, target, status or a field value | That screen                                                                                                       | Actual usage updates                      |
| A screen changes supplied slot content or instance order       | That screen                                                                                                       | Actual usage updates                      |
| A variant entry's props change                                 | That variant entry                                                                                                | No automatic consumer change              |
| Global tokens or screen layout change                          | Rendered screens when output changes; see [path rule](./mokly-component-changes.md#rendered-resources-and-styles) | Rendered-resource evidence                |
| Temporary local prop edit or Reset                             | None                                                                                                              | Preview only                              |

| CSS delivery                | Direct Changes                                                                        | Secondary evidence              |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| Configured stylesheet       | Components with kept own-page matches; pages with outside matches or unresolved rules | Consumers of changed components |
| Declared `stylesheets` file | The same rule; no declared owner attribution                                          | The same affected-consumer rule |
| Import from a stylesheet    | The same rule applied to the imported file                                            | The same affected-consumer rule |
| JavaScript-imported CSS     | The same rule using equal changed rules across generated bundles                      | The same affected-consumer rule |

The initial registration migration may create legitimate one-time structural
changes against an unregistered baseline. Do not add blanket Review ignores to
hide them. Prove steady-state attribution with two fully registered snapshots.
Style-attribution tests cover the current rule: retain meaningful
global/layout assertions and use the shared component-aware classifier for
CSS kept own-page matches and owned document styles, not the old raw changed-path helper.
