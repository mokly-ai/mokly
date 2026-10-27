/**
 * Execute the binary with inherited streams and platform-aware signal
 * handling. POSIX forwards SIGINT, SIGTERM and SIGHUP to the binary. On
 * Windows the binary shares the console and receives its signals directly, so
 * the SIGINT and SIGBREAK listeners only keep the shim alive until the binary
 * exits.
 */
export function executeNative(binary, arguments_, dependencies) {
  return new Promise((resolve, reject) => {
    const child = dependencies.spawn(binary, arguments_, { stdio: "inherit" });
    const signals =
      dependencies.platform === "win32"
        ? ["SIGINT", "SIGBREAK"]
        : ["SIGINT", "SIGTERM", "SIGHUP"];
    const handlers = signals.map((signal) => () => {
      if (dependencies.platform !== "win32") child.kill(signal);
    });
    const cleanup = () => {
      signals.forEach((signal, index) =>
        dependencies.unsubscribe(signal, handlers[index]),
      );
    };
    signals.forEach((signal, index) =>
      dependencies.subscribe(signal, handlers[index]),
    );
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (status) => {
      cleanup();
      resolve(status === 0 ? 0 : 1);
    });
  });
}
