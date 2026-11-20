const deadline = performance.now() + 600_000;
let ready = false;
while (performance.now() < deadline) {
  try {
    const timeout = Math.max(
      1,
      Math.ceil(Math.min(5_000, deadline - performance.now())),
    );
    const response = await fetch("http://api:8080/v1/health", {
      signal: AbortSignal.timeout(timeout),
    });
    const health = await response.json();
    if (
      response.ok &&
      health.status === "ok" &&
      health.migrations === "current" &&
      health.revision === process.env.MKC_EXPECTED_REVISION &&
      performance.now() < deadline
    ) {
      ready = true;
      break;
    }
  } catch {
    // Readiness, transport and response errors are retried within the deadline.
  }
  const delay = Math.min(2_000, deadline - performance.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}
if (!ready) {
  console.error("API readiness timed out for the intended revision.");
  process.exit(1);
}
