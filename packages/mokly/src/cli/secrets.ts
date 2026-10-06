/** Redact explicit and environment credentials even when argument parsing fails. */
export function redactCliSecrets(
  message: string,
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): string {
  const secrets = [env.MOKLY_TOKEN];
  for (const [index, argument] of argv.entries()) {
    if (argument === "--token") secrets.push(argv[index + 1]);
    if (argument.startsWith("--token=")) secrets.push(argument.slice(8));
  }
  for (const secret of secrets) {
    if (!secret) continue;
    message = message.replaceAll(secret, "[REDACTED]");
    message = message.replaceAll(encodeURIComponent(secret), "[REDACTED]");
  }
  return message;
}
