declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
  export const __esModule: string;
  export const constructor: string;
  export const café: string;
}

declare module "react-native-web" {
  import type { ComponentType, ReactNode } from "react";
  export const View: ComponentType<{ style?: unknown; children?: ReactNode }>;
  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T;
  };
}
