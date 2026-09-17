import type { DataPropSchema, InferProp, PropPrimitive } from "./prop_types.js";

export interface ComponentControlLabel {
  label?: string;
  description?: string;
}
export type ComponentControl = ComponentControlLabel &
  (
    | { kind: "text"; maxLength?: number }
    | { kind: "boolean" }
    | { kind: "number"; minimum?: number; maximum?: number; step?: number }
    | {
        kind: "select";
        options: readonly { label: string; value: PropPrimitive }[];
      }
  );

export type ControlFor<S extends DataPropSchema> =
  | (InferProp<S> extends string
      ? Extract<ComponentControl, { kind: "text" }>
      : never)
  | (InferProp<S> extends boolean
      ? Extract<ComponentControl, { kind: "boolean" }>
      : never)
  | (InferProp<S> extends number
      ? Extract<ComponentControl, { kind: "number" }>
      : never)
  | (InferProp<S> extends PropPrimitive
      ? ComponentControlLabel & {
          kind: "select";
          options: readonly { label: string; value: InferProp<S> }[];
        }
      : never);
