import type { ReactNode } from "react";
export const decorators = [
  (Story: () => ReactNode) => (
    <div data-preview="a">
      <Story />
    </div>
  ),
];
