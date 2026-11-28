import assert from "node:assert/strict";
import vm from "node:vm";

import { IDBFactory } from "fake-indexeddb";

export const frameOrigin = "https://frames.test";

type AbortPoint = "before-request" | "after-put";

export function tokenDatabase() {
  const indexedDB = new IDBFactory();
  const writes: unknown[] = [];
  let nextGet: (() => void) | undefined;
  let nextAbort: AbortPoint | undefined;
  let abortedPuts = 0;
  let committedDeletes = 0;
  let abortedTransactions = 0;

  function observeTransaction(transaction: IDBTransaction) {
    const store = transaction.objectStore("tokens");
    const get = store.get.bind(store);
    store.get = (key) => {
      const request = get(key);
      const callback = nextGet;
      nextGet = undefined;
      callback?.();
      return request;
    };

    if (transaction.mode !== "readwrite") return;
    const abortAt = nextAbort;
    nextAbort = undefined;
    const pendingWrites: unknown[] = [];
    let pendingDeletes = 0;
    transaction.addEventListener("complete", () => {
      writes.push(...pendingWrites);
      committedDeletes += pendingDeletes;
    });
    transaction.addEventListener("abort", () => {
      abortedTransactions++;
    });
    if (abortAt === "before-request") queueMicrotask(() => transaction.abort());

    const put = store.put.bind(store);
    store.put = (value: unknown, key) => {
      const request = put(value, key);
      pendingWrites.push(structuredClone(value));
      if (abortAt === "after-put") {
        request.addEventListener("success", () => {
          transaction.abort();
          abortedPuts++;
        });
      }
      return request;
    };
    const remove = store.delete.bind(store);
    store.delete = (key) => {
      const request = remove(key);
      pendingDeletes++;
      return request;
    };
  }

  const open = indexedDB.open.bind(indexedDB);
  indexedDB.open = (name, version) => {
    const request = open(name, version);
    request.addEventListener("success", () => {
      const database = request.result;
      const transact = database.transaction.bind(database);
      database.transaction = (storeNames, mode, options) => {
        const transaction = transact(storeNames, mode, options);
        observeTransaction(transaction);
        return transaction;
      };
    });
    return request;
  };

  return {
    indexedDB,
    writes,
    onNextGet(callback: () => void) {
      nextGet = callback;
    },
    abortNextTransaction(point: AbortPoint = "before-request") {
      nextAbort = point;
    },
    get abortedPuts() {
      return abortedPuts;
    },
    get committedDeletes() {
      return committedDeletes;
    },
    get abortedTransactions() {
      return abortedTransactions;
    },
  };
}

export function accessWorker(
  code: string,
  storage = tokenDatabase(),
  answer: (request: Request) => Response | Promise<Response> = () =>
    new Response("content"),
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
