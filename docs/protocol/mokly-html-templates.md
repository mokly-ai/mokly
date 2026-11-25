# HTML Body Templates

Status: No HTML body is a template yet. [Milestone 3](../../plans/mokly-html-minijinja-templates.md#milestone-3-discovery-checks) adds the template checks of discovery, [Milestone 4](../../plans/mokly-html-minijinja-templates.md#milestone-4-render-before-the-parse) adds the render before the parse, and [Milestone 5](../../plans/mokly-html-minijinja-templates.md#milestone-5-exact-locations-and-output-checks) adds the exact locations, the output checks, and `html-repair`.

## Purpose And Boundary

Every HTML body is a template: the body of a `.screen.html` screen, a
`.component.html` component, and a `.page.html` page, and each saved variant
slot of a component. The core renders the template to text, then parses the
text as HTML under the [HTML screens contract](./mokly-html-screens.md#screen-body).
The template language is MiniJinja 3.1 with the rules of this page. A body
can print values, loop, branch, set variables, define macros, and compute
text. Front matter, Markdown documents, JavaScript components, and the
sidecar are not templates.

Decision: the whole body renders as text before the HTML parse. Expressions
and a `mokly-for` attribute on the parsed tree were rejected. That form could
not build tag or attribute names from data, open and close a tag across
branches, draw trees of any depth, or loop inside `<style>`, `<title>`, or
`<textarea>`.

## Context

The template context holds the props of the entry, the variant, or the
component instance, and nothing else. A page has no props, so its context is
empty. A saved variant slot renders with the props of the variant that
supplies it. Slot content renders with the props of the body that holds it.

The viewport and the colour scheme are not in the context, so one rendered
text serves every view of an entry. `mokly-viewport` selects content by
viewport. Decision: a viewport or colour-scheme value in the context was
rejected, because each view would then need its own render.

## Values

- An undefined value fails with `html-template` when the template prints it,
  iterates over it, or reads an attribute of it. An `if` test treats an
  undefined value as false.
- A declared optional prop that is absent has the absent value. The absent
  value prints as the empty string, tests false, and iterates as empty. An
  attribute read of the absent value gives the absent value, so `{{a.b}}`
  with an absent `a` prints nothing.
- The `defined` and `undefined` tests and the `default` filter treat the
  absent value as undefined.
- `none` prints as the empty string.
- A number prints as JavaScript's `String(number)` prints it. Negative zero
  prints as `0`.
- Printing an array or a map fails with `html-props`.

## Escaping

Every printed value is HTML-escaped. There is no raw form: the `safe` filter
does not exist, and `{% autoescape %}` fails with `html-template`.

## No Input

The render reads only its context, so equal props give equal rendered text.

- There is no template loader. `include`, `import`, and `extends` fail with
  `html-template`.
- A macro is visible only in the body that defines it.
- No function or filter reads files, the clock, random values, or the
  environment.
- Iteration over a map visits the keys in sorted order.

## Plural

The `plural` filter takes two words. `{{ n | plural("task", "tasks") }}`
gives the first word when `n` is 1 and the second word otherwise. It has no
locale rules.

## Limits

One render has a limit on the work that it does, and nesting of `if`, `for`,
and macro calls has a depth limit. A render that passes either limit fails
with `html-template`.

## Syntax

Template syntax opens with `{{`, `{%`, or `{#`. An opening that does not
close fails with `html-template`. `{% raw %}` and the character reference
`&#123;` write literal braces. A character reference never forms template
syntax. Decision: a lone `{{` as ordinary text was rejected, because a full
template language reads it as the start of an expression.

Template syntax works everywhere in the body text, also in attribute values,
in comments, and in raw text elements such as `<style>` and `<title>`.

## Current Forms

These forms keep their meaning:

- `{{name}}` prints a prop, and `{{a.b}}` reads a path into an object prop.
  Whitespace around the expression does not change it.
- An attribute whose whole value is one `{{ expr }}` follows the boolean
  rule. `true` gives an empty attribute. `false`, `none`, and the absent
  value remove the attribute. Any other value prints as text.
- `$name` on a component element and `mokly-if="$name"` read props of the
  body, under the [HTML screens contract](./mokly-html-screens.md#component-elements).
- A prop name with a hyphen is readable only through `{{name}}`, `$name`, and
  `mokly-if="$name"`, because an expression reads `-` as minus.

## Checks

The core checks each body in three places:

1. Presence checks run on the blanked source before any render. The blanked
   source is the body with each `{{ }}`, `{% %}`, and `{# #}` replaced by
   spaces of the same byte length. These checks cover elements, reserved
   names, slots, and `mokly-viewport` values in every branch.
2. The template analysis runs before any render. It knows the scope of each
   loop and `set` variable. It checks prop reads and `mokly-if` types, and it
   gives the props that no expression reads.
3. Output checks run on each distinct rendered text. They cover duplicate
   attributes, page structure, parser repairs, and forbidden elements that
   data builds.

Decision: duplicate attributes are checked on the rendered text, not over
every branch at once. Two branches can each hold one `class`.

In the analysis, every free name of an expression is a declared prop or a
global function of the template language. Another name fails with
`html-props`. A dotted path from a prop must exist in the prop schema, or it
fails with `html-props`. These checks cover every branch and every variant.
A path from a loop or `set` variable follows the rules of undefined values at
render.

A template syntax error, a forbidden construct, a render failure, and a
passed limit fail with `html-template`.

A parser repair is a change that the HTML parser makes because the rendered
text does not form a valid tree, such as content that it moves out of a
table. A parser repair of a rendered body fails with `html-repair`.
Decision: a repair fails the build and is not a warning, because a template
can build any text, and a silent repair would change the tree with no
message.

## Locations

Every error in a body names the repository-relative file and the one-based
line and column of the authored source, also when the rendered text causes
it:

- A template failure names its own `{{` or `{%`.
- A failure in the rendered text names the authored source that wrote it:
  the start tag of an element, or the `{{` or `{%` that printed it.
- Output that a macro writes names the call of the macro.
- A failure in an attribute value names the start of the attribute. A failure
  that only composition finds, such as a value that the prop schema rejects,
  names the start of the element.
- LF, CRLF, and CR each end one line.

The invocation `source` of an HTML component instance follows the same rule.

## Example

```html
---
title: Task list
props:
  tasks:
    - { id: draft, title: Write the draft, state: done }
    - { id: review, title: Ask for review, state: open }
---

{% set count = tasks | length %}
<h1>{{ count }} {{ count | plural("task", "tasks") }}</h1>
<ul>
  {% for task in tasks %}
  <li class="task task-{{ task.state }}">
    {{ task.title }}{% if task.state == "done" %} (done){% endif %}
  </li>
  {% endfor %}
</ul>
```

The screen renders the heading `2 tasks` and one list item for each task.

## Related Docs

- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [HTML components](./mokly-html-components.md)
- [Component instance identity](./mokly-instances.md)
- [Rendering and document assembly](./mokly-rendering.md)
- [Entry props and variants](./mokly-entry-props.md)
