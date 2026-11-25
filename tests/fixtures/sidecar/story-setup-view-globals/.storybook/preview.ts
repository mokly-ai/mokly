const dark: { theme?: string } = {};

export const parameters = { mokly: { colorSchemes: { dark } } };

export async function beforeAll() {
  await Promise.resolve();
  dark.theme = "ready";
}
