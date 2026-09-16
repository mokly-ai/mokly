/** Bounded immutable render storage with authenticated, expirable identifiers. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  ComponentRenderError,
  type ComponentRenderSuccess,
} from "@mokly/viewer/data";

import { RENDER_BYTES, type TransientRender } from "./transient_assets.js";

export class RenderStore {
  private readonly secret = randomBytes(32);
  private readonly bundles = new Map<
    string,
    { created: number; size: number; value: TransientRender }
  >();
  private bytes = 0;
  constructor(
    private readonly now: () => number = Date.now,
    private readonly byteLimit = RENDER_BYTES,
    private readonly countLimit = 16,
    private readonly ttl = 5 * 60_000,
  ) {}
  put(value: TransientRender, generation: string): ComponentRenderSuccess {
    const size = [...value.files.values()].reduce(
      (total, file) => total + file.bytes.byteLength,
      Buffer.byteLength(
        JSON.stringify({
          props: value.props,
          view: value.view,
          route: value.route,
        }),
      ),
    );
    if (size > this.byteLimit)
      throw new ComponentRenderError(
        "render-failed",
        "The preview is too large. Reduce its content and try again.",
      );
    this.expire();
    while (
      this.bundles.size >= this.countLimit ||
      this.bytes + size > this.byteLimit
    )
      this.remove(this.bundles.keys().next().value!);
    const nonce = randomBytes(24).toString("hex");
    const id = `${nonce}.${this.signature(nonce)}`;
    this.bundles.set(id, { created: this.now(), size, value });
    this.bytes += size;
    return {
      renderId: id,
      generation,
      props: value.props,
      view: value.view,
      previewUrl: `/__mokly/components/renders/${id}/${value.route.split("/").map(encodeURIComponent).join("/")}`,
    };
  }
  get(id: string): TransientRender {
    const match = /^([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(id);
    if (
      !match ||
      !timingSafeEqual(
        Buffer.from(match[2]!, "hex"),
        Buffer.from(this.signature(match[1]!), "hex"),
      )
    )
      throw new ComponentRenderError("unknown-entry", "Preview not found.");
    this.expire();
    const bundle = this.bundles.get(id);
    if (!bundle)
      throw new ComponentRenderError(
        "expired",
        "This preview expired. Render it again to continue.",
      );
    return bundle.value;
  }
  clear(): void {
    this.bundles.clear();
    this.bytes = 0;
  }
  private signature(nonce: string): string {
    return createHmac("sha256", this.secret).update(nonce).digest("hex");
  }
  private expire(): void {
    for (const [id, bundle] of this.bundles)
      if (this.now() - bundle.created >= this.ttl) this.remove(id);
  }
  private remove(id: string): void {
    const bundle = this.bundles.get(id);
    if (bundle) this.bytes -= bundle.size;
    this.bundles.delete(id);
  }
}
