/** Parent transport closure is a quiet shutdown, not a consumer diagnostic. */
export function guardParentOutput(): void {
  const closed = (error: NodeJS.ErrnoException) => {
    if (
      error.code === "EPIPE" ||
      error.code === "ERR_STREAM_DESTROYED" ||
      error.code === "ERR_IPC_CHANNEL_CLOSED"
    )
      process.exit(0);
    throw error;
  };
  process.stdout.on("error", closed);
  process.stderr.on("error", closed);
  process.on("error", closed);
}
