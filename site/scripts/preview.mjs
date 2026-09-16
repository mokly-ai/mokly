import { preview } from "astro";

const port = Number(process.argv[2]);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Site preview requires a TCP port (1–65535)");
}

// The API keeps the server in this process, including in agent environments.
const server = await preview({ server: { host: "127.0.0.1", port } });
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    void server.stop();
  });
}
