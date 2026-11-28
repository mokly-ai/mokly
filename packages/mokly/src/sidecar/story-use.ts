import type { ReactNode } from "react";

import { withAuthoringErrors } from "../authoring/errors.js";

import type { Generation } from "./bundle.js";
import type { StorySite } from "./story-body-edits.js";
import { storyComponentType } from "./story-components.js";
import {
  BodyBindings,
  mirrorStatics,
  reactClass,
  refComponentKind,
} from "./story-use-bindings.js";
import {
  prepareStoryUse,
  type PreparedStoryUse,
} from "./story-use-instance.js";
import {
  invocation,
  storyInvocation,
  type CreateElement,
  type CreateSuppliedElement,
  type Element,
  type Invocation,
  type Props,
} from "./story-use-invocation.js";
import { StoryUseRefs } from "./story-use-refs.js";

type Body = (...args: unknown[]) => ReactNode;
type Constructor = abstract new (...args: unknown[]) => object;

interface JsxSource {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

export class StoryUses {
  private readonly bodies = new BodyBindings();
  private readonly early = new WeakMap<object, Invocation>();
  private readonly refs = new StoryUseRefs();
  private readonly columns = new Map<string, Map<string, number>>();
  private readonly classes = new WeakMap<object, PreparedStoryUse>();
  private factory?: CreateElement;

  constructor(private readonly generation: Generation) {}

  private jsx(): CreateElement {
    return (this.factory ??= this.generation.require("react/jsx-runtime").jsx);
  }

  private readonly createSupplied: CreateSuppliedElement = (
    type,
    props,
    key,
    original,
  ) => {
    const element = this.jsx()(type, props, key);
    const use = invocation(props);
    if (
      original &&
      use?.type === type &&
      Object.hasOwn(props, "ref") &&
      refComponentKind(use.type) === "forwardRef"
    )
      this.recordRefUse(
        element,
        use,
        invocation(original.props) ?? this.early.get(original.props),
      );
    return element;
  };

  mark(type: object, name?: string): void {
    this.bodies.mark(type, name);
  }

  sites(file: string, sites: StorySite[]): void {
    this.columns.set(
      file,
      new Map(
        sites.map(([line, compiled, authored]) => [
          `${line}:${compiled}`,
          authored,
        ]),
      ),
    );
  }

  source(site: JsxSource | undefined): JsxSource | undefined {
    if (!site) return;
    const columns = this.columns.get(site.fileName);
    if (!columns) return site;
    const columnNumber = columns.get(`${site.lineNumber}:${site.columnNumber}`);
    return columnNumber === undefined ? undefined : { ...site, columnNumber };
  }

  binding(value: unknown): unknown {
    return this.bodies.binding(value, (original) => {
      const type = original as Element["type"];
      const direct = typeof original === "function" && !reactClass(original);
      const run = this.body.bind(this);
      const render: Body = (input) => this.jsx()(type, input as Props);
      const wrapper = mirrorStatics(function (this: unknown, props, ...rest) {
        return run(
          wrapper,
          this,
          [props, ...rest],
          direct ? (...args) => Reflect.apply(original, this, args) : render,
        );
      }, original);
      return wrapper;
    });
  }

  element(
    create: CreateElement,
    type: Element["type"],
    props: Props,
    key: unknown,
    source: unknown,
  ): Element {
    if (!storyComponentType(type)) return create(type, props, key);
    const carried = invocation(props);
    const retained =
      carried?.type === type && carried.slots.length ? carried : undefined;
    const known = this.generation.storyComponents.handles(type).length > 0;
    if (this.generation.definitions && !known && !retained)
      return create(type, props, key);
    const explicitRef = props && Object.hasOwn(props, "ref");
    const refKind =
      explicitRef || retained ? refComponentKind(type) : undefined;
    if (explicitRef && refKind === "class") return create(type, props, key);
    const use: Invocation = retained
      ? { ...retained, key: key === undefined ? retained.key : key }
      : { type, key, source, slots: [] };
    if (this.bodies.instrumented(type) || retained) {
      const element = create(
        type,
        known || retained ? { ...props, [storyInvocation]: use } : props,
        key,
      );
      if (!known && !retained) this.early.set(element.props, use);
      if (refKind === "forwardRef") this.recordRefUse(element, use, retained);
      return element;
    }
    const element = create(type, props, key);
    const StoryUse = mirrorStatics((input) => {
      const prepared = this.prepare(input, use);
      return withAuthoringErrors(() =>
        prepared.finish(
          this.generation.runtime.react.cloneElement(element, prepared.props),
        ),
      );
    }, type);
    return this.jsx()(StoryUse, { ...element.props }, element.key ?? undefined);
  }

  body(
    self: object,
    receiver: unknown,
    args: ArrayLike<unknown>,
    original: Body,
    constructor?: Constructor,
  ): ReactNode {
    const input = Array.from(args);
    if (constructor) return Reflect.construct(original, input, constructor);
    const use = this.forBody(self, input[0], input[1]);
    if (!use) return Reflect.apply(original, receiver, input);
    const React = this.generation.runtime.react;
    const state = React.useRef<PreparedStoryUse | null>(null);
    const prepared = (state.current ??= this.prepare(input[0], use));
    input[0] = prepared.props;
    const output = prepared.run(() => Reflect.apply(original, receiver, input));
    return withAuthoringErrors(() => prepared.finish(output));
  }

  classBody(
    self: object,
    instance: { props: Props },
    original: () => ReactNode,
  ): ReactNode {
    const use = this.forBody(self, instance.props);
    if (!use) return original();
    let prepared = this.classes.get(instance);
    if (!prepared) {
      prepared = this.prepare(instance.props, use);
      this.classes.set(instance, prepared);
    }
    const saved = instance.props;
    const output = prepared.run(() => {
      instance.props = prepared.props;
      try {
        return original();
      } finally {
        instance.props = saved;
      }
    });
    return withAuthoringErrors(() => prepared.finish(output));
  }

  private recordRefUse(
    element: Element,
    use: Invocation,
    replaces?: Invocation,
  ): void {
    this.refs.record(
      element.props,
      use,
      this.generation.runtime.currentSession(),
      replaces,
    );
  }

  private forBody(
    self: object,
    props: unknown,
    ref?: unknown,
  ): Invocation | undefined {
    if (!props || typeof props !== "object") return;
    let use = invocation(props) ?? this.early.get(props);
    if (!use && ref != null)
      use = this.refs.match(
        props,
        ref,
        this.generation.runtime.currentSession(),
        (type) => this.generation.storyComponents.handles(type).length > 0,
      );
    if (
      use &&
      this.bodies.matches(use.type, self) &&
      (use.slots.length ||
        this.generation.storyComponents.handles(use.type).length)
    )
      return use;
  }

  private prepare(props: unknown, use: Invocation): PreparedStoryUse {
    return withAuthoringErrors(() =>
      prepareStoryUse(
        this.generation,
        props as Props,
        use,
        (type) => this.bodies.instrumented(type),
        this.createSupplied,
      ),
    );
  }
}
