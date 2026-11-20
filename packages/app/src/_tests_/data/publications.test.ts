import assert from "node:assert/strict";
import { test } from "node:test";

import type { Middleware } from "openapi-fetch";

import { api } from "../../api/client";
import {
  followPages,
  getShareLink,
  listScreens,
  referencePageLimit,
} from "../../data/publications";
import type { Page } from "../../data/publications";

/** A list of `total` numbers served `size` at a time, recording what was asked. */
function paged(
  total: number,
  size: number,
): {
  read: (cursor?: string) => Promise<Page<number>>;
  asked: () => (string | undefined)[];
} {
  const cursors: (string | undefined)[] = [];
  return {
    asked: () => cursors,
    read: (cursor?: string) => {
      cursors.push(cursor);
      const from = cursor === undefined ? 0 : Number(cursor);
      const items = Array.from(
        { length: Math.min(size, total - from) },
        (_unused, index) => from + index,
      );
      const next = from + items.length;
      return Promise.resolve({
        items,
        nextCursor: next < total ? String(next) : null,
      });
    },
  };
}

test("a list shorter than one page is read once", async () => {
  const list = paged(3, 50);
  assert.deepEqual(await followPages(list.read), {
    items: [0, 1, 2],
    truncated: false,
  });
  assert.deepEqual(list.asked(), [undefined]);
});

test("the cursor is followed until the list is exhausted", async () => {
  const list = paged(61, 50);
  const { items, truncated } = await followPages(list.read);
  assert.equal(items.length, 61);
  // The order the API returned the rows in is the order the panel shows them.
  assert.deepEqual(items.slice(0, 2), [0, 1]);
  assert.equal(items[60], 60);
  assert.equal(truncated, false);
  assert.deepEqual(list.asked(), [undefined, "50"]);
});

test("an exhausted list is not asked one more time", async () => {
  // The last page carries no cursor, so a loop that asked again would read a
  // page the API never offered.
  const list = paged(100, 50);
  await followPages(list.read);
  assert.deepEqual(list.asked(), [undefined, "50"]);
});

test("a list that never ends stops at the documented cap and says so", async () => {
  const endless = {
    asked: 0,
    read(): Promise<Page<number>> {
      endless.asked += 1;
      return Promise.resolve({ items: [endless.asked], nextCursor: "more" });
    },
  };
  const { items, truncated } = await followPages(() => endless.read());
  assert.equal(endless.asked, referencePageLimit);
  assert.equal(items.length, referencePageLimit);
  // The whole reason the shape is not a bare array: a capped read that
  // answered with only its rows would look exactly like a complete one.
  assert.equal(truncated, true);
});

test("a list that ends exactly on the cap is not called truncated", async () => {
  // The last page carries no cursor, so the walk ended because the list did,
  // even though it used every page it was allowed.
  const list = paged(referencePageLimit * 50, 50);
  const { items, truncated } = await followPages(list.read);
  assert.equal(items.length, referencePageLimit * 50);
  assert.equal(truncated, false);
});

for (const total of [
  103,
  referencePageLimit * 50,
  referencePageLimit * 50 + 1,
]) {
  test(`Share reads ordered screen pages with ${total} rows`, async () => {
    const list = paged(total, 50);
    const screen = (index: number) => ({
      path: `screen-${String(index).padStart(4, "0")}`,
      title: `Title ${total - index}`,
      views: [{ viewport: "desktop", colorScheme: "light" }],
    });
    const interceptor: Middleware = {
      async onRequest({ request }) {
        const cursor = new URL(request.url).searchParams.get("cursor");
        const page = await list.read(cursor ?? undefined);
        return new Response(
          JSON.stringify({ ...page, items: page.items.map(screen) }),
          { headers: { "content-type": "application/json" } },
        );
      },
    };
    api.use(interceptor);
    try {
      const result = await listScreens("project", "publication");
      const loaded = Math.min(total, referencePageLimit * 50);
      assert.deepEqual(
        list.asked(),
        Array.from({ length: Math.ceil(loaded / 50) }, (_unused, index) =>
          index === 0 ? undefined : String(index * 50),
        ),
        "Share follows every offered cursor up to the cap",
      );
      assert.deepEqual(result, {
        items: Array.from({ length: loaded }, (_unused, index) =>
          screen(index),
        ),
        truncated: total > loaded,
      });
    } finally {
      api.eject(interceptor);
    }
  });
}

test("Share sends the entry path as catalogueScreen and encodes it once", async () => {
  let sent: Request | undefined;
  const link = {
    url: "https://app.example/org/project/publications/p1?catalogueScreen=Product%2FWelcome_1",
    access: "public",
  };
  const interceptor: Middleware = {
    onRequest({ request }) {
      sent = request;
      return new Response(JSON.stringify(link), {
        headers: { "content-type": "application/json" },
      });
    },
  };
  api.use(interceptor);
  try {
    assert.deepEqual(
      await getShareLink("project", "p1", {
        screen: "Product/Welcome_1",
        viewport: "mobile",
        scheme: "dark",
      }),
      link,
    );
    assert.ok(sent);
    const query = new URL(sent.url).searchParams;
    assert.deepEqual(
      [...query],
      [
        ["catalogueScreen", "Product/Welcome_1"],
        ["viewport", "mobile"],
        ["scheme", "dark"],
      ],
    );
    assert.match(sent.url, /catalogueScreen=Product%2FWelcome_1/);
  } finally {
    api.eject(interceptor);
  }
});
