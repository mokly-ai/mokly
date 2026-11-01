# Base Install Processes

Status: Follow-up work remains in the [Yarn Classic script stop item](../../plans/follow-ups/yarn-classic-script-stop.md).

This page defines how Mokly runs the package managers of a
[base dependency install](./mokly-base-dependencies.md#installation-and-bundle-settings):
the environment that each manager starts from, the executables, the bounds,
and the stops. [Base preparation](./mokly-base-preparation.md) owns
cancellation, and the [runtime](./mokly-runtime.md#shutdown) owns shutdown
order.

## Environment

Each install starts from an allowed list of environment variables, not the
inherited environment, so a manager and its lifecycle scripts do not receive
an inherited secret such as `MOKLY_TOKEN`, `GITHUB_TOKEN`, or `NPM_TOKEN`.
The allowed list holds no secret:

- `PATH` and `HOME`.
- The proxy variables `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, and `ALL_PROXY`,
  in upper and lower case.
- The certificate variables `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, and
  `SSL_CERT_DIR`.
- The variables that a process needs to start. Unix uses `TMPDIR`, `LANG`,
  `LC_ALL`, every `LC_*`, `TZ`, `USER`, and `LOGNAME`. Windows uses
  `SystemRoot`, `windir`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP`, `USERPROFILE`,
  `APPDATA`, `LOCALAPPDATA`, `HOMEDRIVE`, `HOMEPATH`, `NUMBER_OF_PROCESSORS`,
  and `PROCESSOR_ARCHITECTURE`.
- The names that Mokly fixes, with the values that Mokly sets.

Mokly removes every other inherited variable. Windows matches a variable name
without case. Mokly passes no inherited `MOKLY_` variable to a package manager
or a lifecycle script.

The [token exposure rule](./mokly-upload.md#token-exposure) states the limit
of this protection for code that runs as the same user. Decision: the scripts
mode does not depend on a token. Rejected: scripts off when a token is present,
because every publish needs a token and would lose the opt-in.

## Manager Executables

Resolve managers in the parent through absolute PATH entries only. The child
also receives only absolute PATH entries, so a script interpreter cannot
select historical code. On Windows a native launcher runs directly. Standard
npm-installed and Corepack `.cmd` layouts use their Node CLI. A source
directory or relative PATH entry never supplies the manager. Unsupported
launchers fall back.

## Bounds And Stops

Version discovery and every selected install share one monotonic deadline.
The byte bound applies while an install runs. Vanished files or directories
do not stop the install. Only a failed spawn or unavailable executable has the
typed command-unavailable result.

When Mokly stops a manager because of cancellation, the time limit, the byte
bound, or the bound on its output, it signals the manager's process group and
every process that descends from the manager through parent links when the
stop starts. This includes a process in a new session, such as a dependency
script that Yarn Classic starts in a new session on Linux and macOS. On Linux,
a stop while the manager runs also signals a descendant whose parent exited
before the stop. Windows uses the manager's owned job. Decision: signal every
descendant. Rejected: scripts off for Yarn Classic on Unix, because Classic
projects would lose the opt-in.

Two limits remain. On macOS, a stop does not signal a descendant outside the
manager's process group whose parent exited before the stop. After a normal
finish, Mokly signals only the manager's process group, so a process in a new
session that a finished script left behind is outside that signal.
