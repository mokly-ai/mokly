/** A forked command owns its stdout and exit code without test events. */
process.stdout.write("guard child stdout\n");
process.exitCode = 7;
