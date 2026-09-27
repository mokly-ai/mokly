import fs from "node:fs";

import { PlainReporter } from "../../dist/cli/reporter/plain.js";

const serveReady = PlainReporter.prototype.serveReady;
const pause = new Int32Array(new SharedArrayBuffer(4));

PlainReporter.prototype.serveReady = function (report): void {
  serveReady.call(this, report);
  process.stdout.write("MOKLY_TEST_READY_REPORT_BLOCKED\n");
  waitForInput();
};

function waitForInput(): void {
  const input = Buffer.alloc(1);
  while (true) {
    try {
      fs.readSync(process.stdin.fd, input, 0, 1, null);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EAGAIN" && code !== "EINTR") throw error;
    }
    Atomics.wait(pause, 0, 0, 10);
  }
}
