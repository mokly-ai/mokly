# Git Command Runtime

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-git` runs Git through a trait-backed command runner, with an explicit
checkout directory and argument vector. It starts no shell. Standard output
and standard error are captured concurrently, with a 64 MiB bound per stream.
An output-limit failure terminates the owned process tree.
Requests can select a smaller bound. A request above 64 MiB fails with
`InvalidOutputLimit` before process configuration or command execution.

## Child Environment

Every Git command removes repository and history selection variables:

- `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_COMMON_DIR`;
- `GIT_OBJECT_DIRECTORY` and `GIT_ALTERNATE_OBJECT_DIRECTORIES`;
- `GIT_NAMESPACE` and `GIT_PREFIX`;
- `GIT_SHALLOW_FILE`, `GIT_GRAFT_FILE`, and `GIT_REPLACE_REF_BASE`;
- `GIT_NO_REPLACE_OBJECTS` and `GIT_IMPLICIT_WORK_TREE`.

A command therefore reads the requested checkout and its history even when
Mokly starts inside a Git hook. `GIT_CONFIG_*` variables stay inherited.
This preserves CI overrides such as `safe.directory`. Other environment
values stay inherited.

## Batches And Cancellation

Path requests use bounded batches. An empty path list starts no command.
Batches preserve the requested order and stop at the first failed invocation.
A path too large for one batch fails before command execution.

Tree and blob reads use bounded output and stdin input through the same
runner. Cancellation requests SIGTERM for the whole process group, then
SIGKILL after one second if it remains. Windows uses the owned job. A command
settles after the process and its pipes close. The
[runtime shutdown contract](./mokly-runtime.md#shutdown) owns shutdown order.
