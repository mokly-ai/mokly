import { execFile, spawn } from "node:child_process";

const OUTPUT_LIMIT = 32 * 1024 * 1024;

export function runCommand(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer: OUTPUT_LIMIT,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `${file} ${args.join(" ")} failed\n${stdout}${stderr}`.trim(),
              { cause: error },
            ),
          );
          return;
        }
        resolve({ stderr, stdout });
      },
    );
  });
}

export function runCommandResult(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({ code, signal, stderr, stdout });
    });
  });
}
