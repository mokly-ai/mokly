import { platformPackage } from "./platform.mjs";
import { assertNativeVersion, assertNodeVersion } from "./version.mjs";

/** Resolve and execute the exact matching binary through an injected runtime. */
export async function runShim(arguments_, runtime) {
  assertNodeVersion(runtime.nodeVersion);
  const name = platformPackage(
    runtime.platform,
    runtime.architecture,
    runtime.glibc,
  );
  const cli = runtime.cliPackage();
  let native;
  try {
    native = runtime.nativePackage(name);
  } catch {
    throw new Error(
      `Mokly could not load ${name}@${cli.version}. Reinstall @mokly/mokly with optional dependencies enabled.`,
    );
  }
  assertNativeVersion(cli.version, native.version, name);
  try {
    return await runtime.execute(native.binary, arguments_);
  } catch {
    throw new Error(
      `Mokly could not start the binary from ${name}@${cli.version}. Reinstall @mokly/mokly and run mokly again.`,
    );
  }
}
