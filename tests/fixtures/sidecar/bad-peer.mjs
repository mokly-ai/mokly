process.stdin.once("data", () => {
  process.stdout.write('{"event":"diagnostic","params":{"message":"early"}}\n');
});
