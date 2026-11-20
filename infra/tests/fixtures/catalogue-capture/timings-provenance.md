# Capture Timing Sample

`mokly-publish-timings.stderr.txt` contains the first stderr timing event from
installed `@mokly/mokly@0.18.0`. The real CLI produced it on 2026-11-01.

`python3 infra/scripts/record-catalogue-capture.py` rebuilds the isolated
publication smoke fixture. It runs a successful strict publish with
`--debug-timings` through the real loopback capture receiver. It saves the
first complete timing line without changing its bytes.

The sample keeps the CLI's session, process ID and elapsed value. It contains
no bearer value. The CLI double replays this sample only when the flag is
present. Default recorded streams do not include timing events.
