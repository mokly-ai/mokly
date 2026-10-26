<p align="center">
  <img src="https://mokly.ai/brand/mokly-logo.svg" alt="Mokly" width="360">
</p>

<p align="center">
  <strong>
    Build browsable, reviewable mockup catalogues from HTML, React, and Storybook.
  </strong>
</p>

Mokly turns your product screens into a searchable catalogue. Write a screen
as an HTML file, a React component, or a Storybook story. Mokly renders each
screen at mobile and desktop sizes, in light and dark, and shows which screens
changed between two Git commits.

`@mokly/mokly` gives you the `mokly` command and the authoring API.

> Mokly is pre-1.0.

## Install

```bash
npm install --save-dev @mokly/mokly
```

Mokly needs Node.js `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`.
It runs on Linux x64 and arm64 with glibc, macOS x64 and arm64, and Windows
x64. React screens and components also need `react` and `react-dom` 19 or
newer.

## Quick start

1. Create `mokly.config.json` in your repository root:

   ```json
   { "$schema": "./node_modules/@mokly/mokly/config.schema.json" }
   ```

   Mokly reads your entries from the `specs` directory.

2. Create `specs/welcome.screen.html`:

   ```html
   ---
   title: Welcome
   description: The first screen after sign-in.
   props: { name: Ada, returning: true }
   variants:
     - slug: first-visit
       title: First visit
       props: { returning: false }
   ---

   <main>
     <h1>Welcome, {{name}}</h1>
     <p mokly-if="$returning">Your workspace is ready.</p>
   </main>
   ```

3. Open the catalogue:

   ```bash
   npx --no-install mokly serve --open
   ```

   The catalogue updates when you save a file.

## Write a screen in React

Create `specs/account/account-home.mockup.tsx`:

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The account landing screen.",
  relatedDocs: [],
  props: { name: "Sam" },
  render: (props) => <main>Hello, {props.name}</main>,
});
```

| Export                 | Use it for                                                         |
| ---------------------- | ------------------------------------------------------------------ |
| `defineScreen`         | A product screen with props and variants                           |
| `defineComponent`      | A reusable component with a prop schema, slots, and saved variants |
| `definePage`           | A complete HTML page without device variants                       |
| `defineUseCase`        | An ordered flow through existing screens                           |
| `defineFolder`         | The title, order, and visibility of a folder                       |
| `MockLink`, `mockLink` | A link to another catalogue entry                                  |
| `ReviewIgnore`         | Shared chrome that comparisons leave out                           |

## Commands

| Command         | What it does                                                   |
| --------------- | -------------------------------------------------------------- |
| `mokly serve`   | Serve the catalogue and update it as you edit                  |
| `mokly build`   | Check the catalogue and write a static site to `mokly-static/` |
| `mokly publish` | Build the catalogue and upload it to a catalogue service       |
| `mokly --help`  | Show every command and option                                  |

## Documentation

- [Getting started](https://mokly.ai/docs/start/install/)
- [Configuration](https://mokly.ai/docs/authoring/config/)
- [Screens](https://mokly.ai/docs/authoring/screens/) and
  [components](https://mokly.ai/docs/authoring/components/)
- [Review changes](https://mokly.ai/docs/catalogue/changes/)
- [Host a static catalogue](https://mokly.ai/docs/catalogue/export-and-host/)
- [Publish from CI](https://mokly.ai/docs/ci/publish-from-ci/)
- [Command reference](https://mokly.ai/docs/cli/serve/)
- [Changelog](https://mokly.ai/changelog/)

The package also includes these guides as Markdown in `docs/guides`.

To embed the catalogue in your own React application, use
[`@mokly/viewer`](https://www.npmjs.com/package/@mokly/viewer).

## Contributing

Mokly is open source at
[github.com/mokly-ai/mokly](https://github.com/mokly-ai/mokly). The
[development guide](https://github.com/mokly-ai/mokly/blob/main/docs/development/README.md)
tells you how to build and test it.

## License

[MIT](https://github.com/mokly-ai/mokly/blob/main/LICENSE)
