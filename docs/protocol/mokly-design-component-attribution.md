# Design Component Attribution

Continuation of [design component adoption](./mokly-design-components.md).

## Acceptance

Acceptance once the base commit has the registered components:

| Edit                                                     | Direct Changes                                                                                                    | Secondary evidence                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Top bar implementation                                   | Top bar                                                                                                           | Consuming design screens                             |
| Nested Tag chip implementation                           | Tag chip                                                                                                          | Picker/Top bar and their screen consumers            |
| A screen changes query, title, target or status          | That screen                                                                                                       | Actual usage updates                                 |
| A screen changes a field value in slot content           | That screen                                                                                                       | Material changes; usage identities can stay the same |
| A screen changes supplied slot content or instance order | That screen                                                                                                       | Actual usage updates                                 |
| A variant entry's props change                           | That variant entry                                                                                                | No automatic consumer change                         |
| Global tokens or screen layout change                    | Rendered screens when output changes; see [path rule](./mokly-component-changes.md#rendered-resources-and-styles) | Rendered-resource evidence                           |
| Temporary local prop edit or Reset                       | None                                                                                                              | Preview only                                         |

| CSS delivery                | Direct Changes                                                                        | Secondary evidence              |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| Configured stylesheet       | Components with kept own-page matches; pages with outside matches or unresolved rules | Consumers of changed components |
| Declared `stylesheets` file | The same rule; no declared owner attribution                                          | The same affected-consumer rule |
| Import from a stylesheet    | The same rule applied to the imported file                                            | The same affected-consumer rule |
| JavaScript-imported CSS     | The same rule using equal changed rules across bundle generations                     | The same affected-consumer rule |

The initial registration migration may create legitimate one-time structural
changes against a base commit without registered components. Do not add blanket
Review ignores to hide them. Prove steady-state attribution with two fully
registered commits.
Style-attribution tests cover the current rule: keep meaningful
global/layout assertions and use the shared component-aware classifier for
CSS kept own-page matches and owned document styles, not a raw changed-path helper.
