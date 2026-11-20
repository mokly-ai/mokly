/**
 * Outbound request interceptors for the origin-router tests. They keep the
 * subset of the former `cloudflare:test` `fetchMock` API that the tests use:
 * each interceptor answers one matching request, an unmatched request fails,
 * and `assertNoPendingInterceptors` fails while an interceptor is unused.
 */

interface Match {
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

interface Interceptor extends Match {
  origin: string;
  reply?: { status: number; body: BodyInit; init: ResponseInit };
}

const pending: Interceptor[] = [];

function describeRequest(request: Request): string {
  return `${request.method} ${request.url}`;
}

async function matches(
  interceptor: Interceptor,
  request: Request,
): Promise<boolean> {
  const url = new URL(request.url);
  if (url.origin !== interceptor.origin) return false;
  if (`${url.pathname}${url.search}` !== interceptor.path) return false;
  if (request.method !== interceptor.method) return false;
  for (const [name, value] of Object.entries(interceptor.headers ?? {})) {
    if (request.headers.get(name) !== value) return false;
  }
  if (interceptor.body === undefined) return true;
  return (await request.clone().text()) === interceptor.body;
}

async function intercepted(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  for (const [index, interceptor] of pending.entries()) {
    if (!interceptor.reply || !(await matches(interceptor, request))) continue;
    pending.splice(index, 1);
    const { status, body, init: replyInit } = interceptor.reply;
    return new Response(body, { ...replyInit, status });
  }
  throw new Error(`No interceptor matches ${describeRequest(request)}`);
}

export const fetchMock = {
  /** Routes every global fetch through the interceptors. */
  activate(): void {
    globalThis.fetch = intercepted as typeof fetch;
  },
  /** Unmatched requests already fail; kept for the former API shape. */
  disableNetConnect(): void {},
  assertNoPendingInterceptors(): void {
    const unused = pending.splice(0);
    if (unused.length > 0) {
      const names = unused.map(
        (interceptor) =>
          `${interceptor.method} ${interceptor.origin}${interceptor.path}`,
      );
      throw new Error(`Unused interceptors: ${names.join(", ")}`);
    }
  },
  get(origin: string) {
    return {
      intercept(match: Match) {
        const interceptor: Interceptor = { ...match, origin };
        pending.push(interceptor);
        return {
          reply(status: number, body: BodyInit, init: ResponseInit = {}) {
            interceptor.reply = { status, body, init };
          },
        };
      },
    };
  },
};
