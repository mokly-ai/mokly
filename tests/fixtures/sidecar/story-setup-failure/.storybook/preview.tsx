let attempts = 0;

export async function beforeAll() {
  await Promise.resolve();
  throw new Error(`beforeAll failed on attempt ${++attempts}`);
}
