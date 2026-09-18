/** Declarative component data shared by authoring, artifacts, and controls. */
export type PropPrimitive = string | number | boolean | null;
export type PropValue =
  PropPrimitive | readonly PropValue[] | { readonly [key: string]: PropValue };
export type ComponentPropsData = Readonly<Record<string, PropValue>>;

export type DataPropSchema =
  | { kind: "string"; minLength?: number; maxLength?: number }
  | { kind: "boolean" }
  | { kind: "number"; minimum?: number; maximum?: number; integer?: boolean }
  | { kind: "null" }
  | { kind: "enum"; values: readonly PropPrimitive[] }
  | {
      kind: "array";
      items: DataPropSchema;
      minItems?: number;
      maxItems?: number;
    }
  | ObjectPropSchema
  | { kind: "union"; anyOf: readonly DataPropSchema[] };

export interface DataPropField {
  schema: DataPropSchema;
  optional?: boolean;
}
export interface ObjectPropSchema {
  kind: "object";
  properties: Readonly<Record<string, DataPropField>>;
}

type OptionalKeys<P extends ObjectPropSchema["properties"]> = {
  [K in keyof P]: P[K] extends { optional: true } ? K : never;
}[keyof P];

/** Schema literals determine required, optional, and nested authoring types. */
export type InferProp<S extends DataPropSchema> = DataPropSchema extends S
  ? PropValue
  : S extends { kind: "string" }
    ? string
    : S extends { kind: "number" }
      ? number
      : S extends { kind: "boolean" }
        ? boolean
        : S extends { kind: "null" }
          ? null
          : S extends { kind: "enum"; values: readonly (infer V)[] }
            ? V
            : S extends { kind: "array"; items: infer I extends DataPropSchema }
              ? readonly InferProp<I>[]
              : S extends {
                    kind: "union";
                    anyOf: readonly (infer U extends DataPropSchema)[];
                  }
                ? InferProp<U>
                : S extends ObjectPropSchema
                  ? {
                      readonly [
                        K in Exclude<
                          keyof S["properties"],
                          OptionalKeys<S["properties"]>
                        >
                      ]: InferProp<S["properties"][K]["schema"]>;
                    } & {
                      readonly [K in OptionalKeys<S["properties"]>]?: InferProp<
                        S["properties"][K]["schema"]
                      >;
                    }
                  : never;

export type ComponentWirePrimitive =
  | readonly ["null"]
  | readonly ["boolean", boolean]
  | readonly ["number", string]
  | readonly ["string", string];
export type ComponentWireValue =
  | ComponentWirePrimitive
  | readonly ["array", readonly ComponentWireValue[]]
  | readonly ["object", readonly (readonly [string, ComponentWireValue])[]];
export type ComponentWireProps = Readonly<Record<string, ComponentWireValue>>;
