import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

import type * as React from "react";

import type { InstanceDraft } from "../generated/sidecar/InstanceDraft.js";
import type { SlotDraft } from "../generated/sidecar/SlotDraft.js";

import type { RenderContext } from "./types.js";

export const brand = Symbol.for("mokly.definition");
export const wrapperBrand = Symbol.for("mokly.component");

export interface DefinitionData {
  kind: string;
  input: Record<string, unknown>;
  source?: string;
  runtime: AuthoringRuntime;
}
export const definitions = new WeakMap<object, DefinitionData>();
export interface Registration {
  handle: string;
  path?: string;
  title?: string;
}
export interface Owner {
  kind: "entry" | "instance";
  instanceKey?: string;
  slotKey?: string;
  seen: Set<string>;
}
export interface RenderSession {
  context: RenderContext;
  sourceRoot: string;
  dependencyRoots: readonly string[];
  location: string;
  instances: InstanceDraft[];
  slots: SlotDraft[];
  registrations: Map<object, Registration>;
  markers: Map<string, string>;
  placeholders: Set<string>;
  boundary: (comment: string) => React.ReactNode;
  nextRegion: () => string;
  link: (target: unknown, fragment?: string, source?: string) => string;
  logicalLink: (value: string) => string;
}

/** A generation owns its React instance and contexts. No attribution is global. */
export class AuthoringRuntime {
  readonly links = new Map<
    string,
    { target: unknown; fragment?: string; source?: string }
  >();
  private active = new AsyncLocalStorage<RenderSession>();
  private reactValue?: typeof React;
  private contextsValue?: {
    session: React.Context<RenderSession | null>;
    owner: React.Context<Owner>;
    ignore: React.Context<boolean>;
  };

  constructor(react?: typeof React) {
    if (react) this.reactValue = react;
  }

  get react(): typeof React {
    return (this.reactValue ??= createRequire(import.meta.url)("react"));
  }

  get contexts() {
    return (this.contextsValue ??= {
      session: this.react.createContext<RenderSession | null>(null),
      owner: this.react.createContext<Owner>({
        kind: "entry",
        seen: new Set(),
      }),
      ignore: this.react.createContext(true),
    });
  }

  session(): RenderSession {
    const session = this.active.getStore();
    if (!session)
      throw new Error("Mokly markers require a sidecar render context");
    return session;
  }

  withSession<T>(session: RenderSession, callback: () => T): T {
    return this.active.run(session, callback);
  }

  definitionLink(target: unknown, fragment?: string, source?: string): string {
    const active = this.active.getStore();
    if (active) return active.link(target, fragment, source);
    const token = `mock:mokly-reference-${randomBytes(24).toString("hex")}`;
    this.links.set(token, {
      target,
      ...(fragment !== undefined ? { fragment } : {}),
      ...(source !== undefined ? { source } : {}),
    });
    return token;
  }
}

export const defaultRuntime = new AuthoringRuntime();

export function definitionData(value: unknown): DefinitionData | undefined {
  return typeof value === "object" && value !== null
    ? definitions.get(value)
    : undefined;
}
