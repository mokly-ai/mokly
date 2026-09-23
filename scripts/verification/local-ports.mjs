import net from "node:net";

/** Choose distinct ports, rejecting a configured port already owned by another server. */
export async function chooseBrowserPorts(count, configured) {
  const ports = new Set();
  for (let index = 0; index < count; index++) {
    const requested =
      index === 0 && configured !== undefined ? Number(configured) : 0;
    if (
      !Number.isSafeInteger(requested) ||
      requested < 0 ||
      requested > 65_535 ||
      (configured !== undefined && index === 0 && requested === 0)
    )
      throw new Error(`Invalid configured browser port: ${configured}`);
    const port = await probePort(requested);
    if (ports.has(port)) throw new Error(`Duplicate browser port: ${port}`);
    ports.add(port);
  }
  return [...ports];
}

function probePort(requested) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(requested, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
