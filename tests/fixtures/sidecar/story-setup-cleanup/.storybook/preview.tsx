export async function beforeAll() {
  await Promise.resolve();
  return async () => {
    await Promise.resolve();
    throw new Error("beforeAll cleanup failed");
  };
}
