/// <reference types="vite/client" />

declare module "@fixture/message" {
  const message: string;
  export default message;
}

declare module "*.svg?react" {
  import type { FC, SVGProps } from "react";

  const Icon: FC<SVGProps<SVGSVGElement>>;
  export default Icon;
}
