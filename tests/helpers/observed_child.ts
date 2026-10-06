import type {
  ChildFactory,
  ChildHandle,
} from "../../packages/mokly/dist/server/child_process.js";

interface ObservedChild {
  exited: boolean;
  fail?: (error: Error) => void;
  finished: Promise<void>;
  forceKills: number;
  handle: ChildHandle;
  terminations: number;
}

/** Observe real process startup, signals and exit, with optional error injection. */
export class ObservedChildFactory implements ChildFactory {
  readonly children: ObservedChild[] = [];
  readonly aliveBeforeSpawn: boolean[] = [];

  constructor(private readonly native: ChildFactory) {}

  spawn(args: readonly string[]): ChildHandle {
    this.aliveBeforeSpawn.push(this.children.some((child) => !child.exited));
    const handle = this.native.spawn(args);
    let finish: () => void = () => undefined;
    const child: ObservedChild = {
      exited: false,
      finished: new Promise((resolve) => {
        finish = resolve;
      }),
      forceKills: 0,
      handle,
      terminations: 0,
    };
    this.children.push(child);
    handle.onExit(() => {
      child.exited = true;
      finish();
    });
    return {
      forceKill() {
        child.forceKills++;
        handle.forceKill();
      },
      onDisconnect: (callback) => handle.onDisconnect(callback),
      onError(callback) {
        child.fail = callback;
        handle.onError(callback);
      },
      onExit: (callback) => handle.onExit(callback),
      onMessage: (callback) => handle.onMessage(callback),
      send: (message) => handle.send(message),
      terminate() {
        child.terminations++;
        handle.terminate();
      },
    };
  }

  async close(): Promise<void> {
    for (const child of this.children) {
      if (!child.exited) child.handle.forceKill();
      await child.finished;
    }
  }
}
