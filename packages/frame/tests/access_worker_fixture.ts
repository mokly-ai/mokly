import assert from "node:assert/strict";
import vm from "node:vm";

export const frameOrigin = "https://frames.test";

type Command = () => void;

export function tokenDatabase() {
  const values = new Map<string, unknown>();
  const writes: unknown[] = [];
  let storeName: string | undefined;
  let tail = Promise.resolve();
  let abort = false;
  const database = {
    createObjectStore(name: string) {
      assert.equal(storeName, undefined);
      storeName = name;
    },
    transaction(name: string, mode: IDBTransactionMode) {
      assert.equal(name, storeName);
      const changes = new Map<string, unknown>();
      const transaction = {
        oncomplete: undefined as Command | undefined,
        onabort: undefined as Command | undefined,
        objectStore(store: string) {
          assert.equal(store, storeName);
          return {
            get(key: string) {
              const request = {
                result: undefined as unknown,
                onsuccess: undefined as Command | undefined,
              };
              tail = tail.then(() => {
                if (abort) {
                  abort = false;
                  transaction.onabort?.();
                  return;
                }
                request.result = structuredClone(values.get(key));
                request.onsuccess?.();
                for (const [key, value] of changes) {
                  values.set(key, value);
                  writes.push(value);
                }
                transaction.oncomplete?.();
              });
              return request;
            },
            put(value: unknown, key: string) {
              assert.equal(mode, "readwrite");
              changes.set(key, structuredClone(value));
            },
          };
        },
      };
      return transaction;
    },
  };
  return {
    indexedDB: {
      open() {
        const request = {
          result: database,
          onupgradeneeded: undefined as Command | undefined,
          onsuccess: undefined as Command | undefined,
        };
        queueMicrotask(() => {
          if (!storeName) request.onupgradeneeded?.();
          request.onsuccess?.();
        });
        return request;
      },
    },
    writes,
    abortNextTransaction() {
      abort = true;
    },
  };
}

export function accessWorker(
  code: string,
  storage = tokenDatabase(),
  answer: (request: Request) => Response = () => new Response("content"),
) {
  const listeners = new Map<string, (event: object) => void>();
  const acknowledgements: { data: string; writes: number }[] = [];
  const requests: Request[] = [];
  let skipWaiting = 0;
  const global = {
    location: new URL(frameOrigin),
    addEventListener(type: string, listener: (event: object) => void) {
      listeners.set(type, listener);
    },
    async skipWaiting() {
      skipWaiting++;
    },
  };
  const context = {
    self: global,
    URL,
    TextEncoder,
    Request,
    Response,
    Headers,
    indexedDB: storage.indexedDB,
    async fetch(input: Request | URL, init?: RequestInit) {
      const request =
        input instanceof Request ? input : new Request(input, init);
      requests.push(request);
      return answer(request);
    },
  };
  Object.defineProperty(context, "caches", {
    get() {
      assert.fail("The access worker accessed CacheStorage");
    },
  });
  vm.runInNewContext(code, context);
  function latched(type: string, event: object) {
    let completion: Promise<unknown> | undefined;
    listeners.get(type)?.(
      Object.assign(event, {
        waitUntil(promise: Promise<unknown>) {
          completion = promise;
        },
      }),
    );
    return completion;
  }
  return {
    requests,
    acknowledgements,
    async install() {
      await latched("install", {});
      return skipWaiting;
    },
    send(
      data: unknown,
      origin = frameOrigin,
      type = "window",
      ports: unknown[] = [],
    ) {
      return latched("message", {
        origin,
        data,
        ports,
        source: {
          type,
          url: `${origin}/static/screen.html`,
          postMessage(data: string) {
            acknowledgements.push({ data, writes: storage.writes.length });
          },
        },
      });
    },
    fetch(request: Request) {
      let result: Promise<Response> | undefined;
      listeners.get("fetch")?.({
        request,
        respondWith(response: Promise<Response>) {
          result = response;
        },
      });
      return result;
    },
  };
}
