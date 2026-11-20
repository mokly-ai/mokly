import assert from "node:assert/strict";

export function canonicalDocument(value) {
  if (Array.isArray(value))
    return `[${value.map(canonicalDocument).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalDocument(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function segments(pointer) {
  assert(pointer.startsWith("/"), `Invalid JSON Pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => {
      assert(!/~(?![01])/u.test(part), `Invalid pointer escape: ${pointer}`);
      return part.replaceAll("~1", "/").replaceAll("~0", "~");
    });
}

export function caseDocument(base, test) {
  assert.equal(
    test.patch !== undefined,
    test.rawDocument === undefined,
    test.name,
  );
  if (test.rawDocument !== undefined) return test.rawDocument;
  let document = structuredClone(base);
  for (const operation of test.patch) {
    assert(["set", "remove"].includes(operation.op), test.name);
    if (operation.path === "") {
      assert.equal(operation.op, "set");
      document = structuredClone(operation.value);
      continue;
    }
    const parts = segments(operation.path);
    const leaf = parts.pop();
    let parent = document;
    for (const part of parts) {
      assert(Object.hasOwn(parent, part), `Missing pointer: ${operation.path}`);
      parent = parent[part];
    }
    if (Array.isArray(parent)) {
      assert(/^(0|[1-9][0-9]*)$/u.test(leaf));
      const index = Number(leaf);
      assert(index < parent.length);
      if (operation.op === "remove") parent.splice(index, 1);
      else parent[index] = structuredClone(operation.value);
    } else {
      assert(parent !== null && typeof parent === "object");
      if (operation.op === "remove") {
        assert(Object.hasOwn(parent, leaf));
        delete parent[leaf];
      } else {
        Object.defineProperty(parent, leaf, {
          value: structuredClone(operation.value),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    }
  }
  return canonicalDocument(document);
}
