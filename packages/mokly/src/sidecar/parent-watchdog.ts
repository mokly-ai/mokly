import { Socket } from "node:net";
import { parentPort, workerData } from "node:worker_threads";

const owner = workerData as number;
const port = parentPort!;
const input = new Socket({ fd: 0, readable: true, writable: false });
const kill = () => process.kill(process.pid, "SIGKILL");
const check = setInterval(() => {
  if (process.ppid !== owner) return kill();
  try {
    process.kill(owner, 0);
  } catch {
    kill();
  }
}, 250);
let closing = false;
let ended: ReturnType<typeof setTimeout> | undefined;
input.on("data", (chunk: Buffer) => port.postMessage({ chunk }));
input.on("end", () => {
  if (closing) return;
  port.postMessage({ end: true });
  ended = setTimeout(kill, 1000);
});
input.on("error", (error) => {
  if (closing) return;
  port.postMessage({ error: error.message });
  ended = setTimeout(kill, 1000);
});
port.on("message", () => {
  if (closing) return;
  closing = true;
  clearInterval(check);
  clearTimeout(ended);
  input.destroy();
  port.close();
});
