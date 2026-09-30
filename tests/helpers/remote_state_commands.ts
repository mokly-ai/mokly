/** Return shell command segments that can delete shared remote Git state. */
export function remoteStateDeletingCommands(
  commands: readonly string[],
): string[] {
  return commands.flatMap((command) =>
    shellCommandSegments(command).filter(isRemoteStateDeletingCommand),
  );
}

function isRemoteStateDeletingCommand(command: string): boolean {
  if (command.toLowerCase().includes("remove-remote-state")) return true;
  const tokens = shellTokens(command);
  if (tokens[0] !== "git") return false;
  const invocation = gitInvocation(tokens);
  if (!invocation) return false;
  const { arguments_: args, subcommand } = invocation;
  if (subcommand === "remote") return args[0] === "remove" || args[0] === "rm";
  if (subcommand === "update-ref")
    return (
      args.some((value) => ["-d", "--delete", "--stdin"].includes(value)) ||
      args.some((value) => value.includes("refs/remotes"))
    );
  if (subcommand === "branch") return deletesRemoteBranch(args);
  if (subcommand === "config") return deletesRemoteConfig(args);
  return false;
}

function deletesRemoteBranch(args: readonly string[]): boolean {
  if (args.includes("--unset-upstream")) return true;
  if (args.some((value) => ["-dr", "-rd", "-Dr", "-rD"].includes(value)))
    return true;
  const deletes = args.some((value) =>
    ["-d", "-D", "--delete"].includes(value),
  );
  const remotes = args.some((value) => ["-r", "--remotes"].includes(value));
  return deletes && remotes;
}

function deletesRemoteConfig(args: readonly string[]): boolean {
  const deletes = args.some((value) =>
    ["--unset", "--unset-all", "--remove-section"].includes(value),
  );
  return deletes && args.some((value) => /^(?:remote|branch)\./iu.test(value));
}

function gitInvocation(
  tokens: readonly string[],
): { arguments_: readonly string[]; subcommand: string } | undefined {
  let index = 1;
  while (index < tokens.length) {
    const value = tokens[index]!;
    if (value === "-C" || value === "-c") {
      index += 2;
      continue;
    }
    if (/^-[Cc].+/u.test(value)) {
      index++;
      continue;
    }
    if (value.startsWith("-")) {
      index++;
      continue;
    }
    return { arguments_: tokens.slice(index + 1), subcommand: value };
  }
}

function shellCommandSegments(source: string): string[] {
  const input = source.replace(/\\\r?\n/gu, " ");
  const segments: string[] = [];
  let quote = "";
  let start = 0;
  for (let index = 0; index < input.length; index++) {
    const character = input[index]!;
    if (quote) {
      if (character === quote) quote = "";
      else if (character === "\\" && quote === '"') index++;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "\\") {
      index++;
      continue;
    }
    if (
      character === "\n" ||
      character === ";" ||
      character === "|" ||
      character === "&"
    ) {
      const segment = input.slice(start, index).trim();
      if (segment) segments.push(segment);
      start = index + 1;
      if (input[index + 1] === character) {
        index++;
        start++;
      }
    }
  }
  const tail = input.slice(start).trim();
  if (tail) segments.push(tail);
  return segments;
}

function shellTokens(command: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote = "";
  const finish = (): void => {
    if (token) tokens.push(token);
    token = "";
  };
  for (let index = 0; index < command.length; index++) {
    const character = command[index]!;
    if (quote) {
      if (character === quote) quote = "";
      else if (character === "\\" && quote === '"')
        token += command[++index] ?? "";
      else token += character;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (/\s/u.test(character)) finish();
    else if (character === "\\") token += command[++index] ?? "";
    else token += character;
  }
  finish();
  return tokens;
}
