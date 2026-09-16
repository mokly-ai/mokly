# Lighthouse tools

This private package holds the report-only site audit runner and its pinned
Lighthouse and Chrome launcher dependencies. It is deliberately outside the
root npm workspaces: Lighthouse requires Node 22.19+, while the CLI and site
support Node 22.14. CI installs it only in the Node 24 `site-lighthouse` job.

From the repository root, using Node 24:

```bash
npm ci
npm ci --prefix site/lighthouse --engine-strict
npm run build --prefix site/lighthouse
npm run site:build
npm run site:lighthouse
```

The build checks the runner with TypeScript; `tsx` executes it without emitted
files. Commit both this package's manifest and lockfile when updating tools.
The CI job audits this lockfile at all severities before building the runner.
`CHROME_PATH` selects Chrome; see [site development](../README.md#lighthouse)
for the routes, settings and failure report. A failed budget remains visible
on its own job and does not block `Required CI`.
