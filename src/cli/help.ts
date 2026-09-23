/** Stable CLI usage rendered by `mokly --help`. */
export const HELP = `Mokly — app-independent React mockup catalogues

Usage:
  mokly [serve] [--config <path>] [--port <port>] [--base <ref>] [--no-watch] [--build] [--open]
  mokly build [--config <path>] [--watch]
  mokly check [--config <path>]
  mokly export --out <path> [--config <path>] [--base <ref>]
  mokly publish [--endpoint <url>] [--token <token>] [--out <path>]
                [--config <path>] [--base <ref> | --no-changes]
                [--repository <host>/<owner>/<name>]

Commands:
  serve    Build and serve the catalogue with on-demand diffs
  build    Transactionally generate static HTML documents and the manifest
  check    Validate source and compare output when tracked in Git
  export   Build a complete static catalogue to deploy with your own host
  publish  Export and upload a catalogue to your chosen service

Options:
  --config <path>  Use an explicit mokly.config file
  --debug-timings  Report phase timings and catalogue counts to stderr
  --port <port>    Starting port; advances if occupied, 0 selects any free port
  --base <ref>     Git base ref used to find the branch point
  --out <path>     Config-relative export directory (required for export)
                   Publish default: .context/mokly-publish
  --endpoint <url> Upload URL (publish; or MOKLY_ENDPOINT)
  --token <token>  Bearer token (publish; or MOKLY_TOKEN)
  --repository <host>/<owner>/<name>  Override publish repository identity
  --no-changes     Publish current catalogue without a comparison baseline
  --watch          Watch consumer inputs (serve default; build opt-in)
  --no-watch       Serve one deterministic snapshot
  --build          Write generated output after complete Serve compilations
  --open           Open the served URL in the default browser
  -h, --help       Show help
  -v, --version    Show installed version

Value options also accept --name=value. Use --token=-TOKEN for a leading dash.
Boolean flags take no value.

Configuration:
  review.baselineBuild  Historical build argv arrays run without a shell using
                        trusted historical code. Defaults: npm ci, then
                        npx --no-install mokly build --config <config-path>
`;
