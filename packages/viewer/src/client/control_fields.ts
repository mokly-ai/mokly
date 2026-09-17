/** Declared controls with native labels, explicit unset state and field errors. */
import { decodeProps, encodeValue } from "../components/codec.js";
import { validateControlledValues } from "../components/controls.js";
import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import type {
  ComponentWirePrimitive,
  PropPrimitive,
} from "../components/prop_types.js";
import { validateValue } from "../components/props.js";
import type { ComponentOverride } from "../components/render_types.js";

import { element } from "./inspector_panels.js";

export interface ControlFields {
  root: HTMLElement;
  read(): Readonly<Record<string, ComponentOverride>> | undefined;
  disable(value: boolean): void;
}
export function controlFields(
  doc: Document,
  component: ManifestComponent,
  variant: ManifestComponentVariant,
  changed: (immediate: boolean) => void,
): ControlFields {
  const root = element(doc, "div");
  root.className = "mbk-control-grid";
  const values = decodeProps(variant.props);
  const fields = Object.entries(component.controls).map(([key, control]) => {
    const value = values[key];
    const group = element(doc, "div");
    group.className = "mbk-control-field";
    const id = `prop-${crypto.randomUUID()}`;
    const label = element(doc, "label", control.label ?? key);
    label.htmlFor = id;
    const input =
      control.kind === "select"
        ? element(doc, "select")
        : element(doc, "input");
    input.id = id;
    input.dataset["propControl"] = key;
    if (input instanceof HTMLInputElement) {
      input.type =
        control.kind === "boolean"
          ? "checkbox"
          : control.kind === "number"
            ? "number"
            : "text";
      if (control.kind === "number") {
        input.step = String(control.step ?? "any");
        if (control.minimum !== undefined) input.min = String(control.minimum);
        if (control.maximum !== undefined) input.max = String(control.maximum);
      }
      if (control.kind === "number") input.inputMode = "decimal";
      if (control.kind === "boolean") input.checked = value === true;
      else
        input.value =
          value === undefined
            ? ""
            : Object.is(value, -0)
              ? "-0"
              : String(value);
    } else if (control.kind === "select") {
      const empty = element(doc, "option", "Choose a value");
      empty.value = "";
      input.append(empty);
      control.options.forEach((option, index) => {
        const node = element(doc, "option", option.label);
        node.value = String(index);
        input.append(node);
      });
      const selected = control.options.findIndex((option) =>
        Object.is(value, option.value),
      );
      input.value = selected < 0 ? "" : String(selected);
    }
    const supplied = component.propSchema.properties[key]?.optional
      ? element(doc, "input")
      : undefined;
    if (supplied) {
      supplied.type = "checkbox";
      supplied.checked = value !== undefined;
      supplied.setAttribute("aria-label", `Supply ${control.label ?? key}`);
      const toggle = element(doc, "label");
      toggle.className = "mbk-control-supplied";
      toggle.append(supplied, element(doc, "span", "Supplied"));
      group.append(toggle);
    }
    const help = element(
      doc,
      "small",
      control.description ??
        (control.kind === "number" &&
        (control.minimum !== undefined || control.maximum !== undefined)
          ? `Allowed range: ${control.minimum ?? "no minimum"} to ${control.maximum ?? "no maximum"}.`
          : ""),
    );
    help.id = `${id}-help`;
    const error = element(doc, "small");
    error.className = "mbk-control-error";
    error.id = `${id}-error`;
    error.hidden = true;
    input.setAttribute("aria-describedby", `${help.id} ${error.id}`);
    input.addEventListener(
      control.kind === "text" || control.kind === "number" ? "input" : "change",
      () => changed(control.kind !== "text" && control.kind !== "number"),
    );
    supplied?.addEventListener("change", () => {
      input.disabled = !supplied.checked;
      changed(true);
    });
    group.append(label, input, help, error);
    root.append(group);
    return { key, control, input, supplied, error };
  });
  return {
    root,
    disable(disabled) {
      for (const { input, supplied } of fields) {
        input.disabled = disabled || supplied?.checked === false;
        if (supplied) supplied.disabled = disabled;
      }
    },
    read() {
      let valid = true;
      const overrides: Record<string, ComponentOverride> = {};
      for (const { key, control, input, supplied, error } of fields) {
        error.hidden = true;
        input.removeAttribute("aria-invalid");
        if (supplied && !supplied.checked) {
          if (values[key] !== undefined) overrides[key] = { kind: "unset" };
          continue;
        }
        try {
          let value: PropPrimitive;
          if (control.kind === "boolean")
            value = (input as HTMLInputElement).checked;
          else if (control.kind === "select") {
            const option =
              input.value === ""
                ? undefined
                : control.options[Number(input.value)];
            if (!option) throw new Error("Choose an available value.");
            value = option.value;
          } else if (control.kind === "number") {
            value = Number(input.value);
            if (!input.value.trim() || !Number.isFinite(value))
              throw new Error("Enter a finite number.");
          } else value = input.value;
          validateValue(
            component.propSchema.properties[key]!.schema,
            value,
            key,
          );
          validateControlledValues({ [key]: control }, { [key]: value }, key);
          if (!Object.is(value, values[key]))
            overrides[key] = {
              kind: "set",
              value: encodeValue(value) as ComponentWirePrimitive,
            };
        } catch {
          error.textContent =
            control.kind === "number"
              ? "Enter a number within the allowed range."
              : control.kind === "select"
                ? "Choose an available value."
                : "Check this value and its allowed limits.";
          error.hidden = false;
          input.setAttribute("aria-invalid", "true");
          valid = false;
        }
      }
      return valid ? overrides : undefined;
    },
  };
}
