import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { projectScopedCatalogue } from "@mokly/viewer/runtime";

import { createReactViewerCapabilities } from "../dist/client/react_capabilities.js";

import {
  actions,
  browseRecovery,
  catalogue,
  currentRequest,
  descriptor,
  FakeEnvironment,
  htmlResponse,
  shellRecovery,
} from "./helpers/react_capability_environment.js";

test("React live updates provide recovery and replace strict-effect streams", () => {
  const environment = new FakeEnvironment();
  environment.storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: browseRecovery(),
      url: environment.location.href,
      version: 4,
    }),
  );
  const capabilities = createReactViewerCapabilities(descriptor, environment);
  const request = currentRequest();
  assert.deepEqual(capabilities.updates.consumeRecovery(request), {
    ...shellRecovery(),
    view: "changes",
  });
  assert.equal(capabilities.updates.consumeRecovery(request), undefined);

  const first = new AbortController();
  capabilities.updates.subscribe(request, actions(), first.signal);
  assert.equal(environment.sources.length, 1);
  first.abort();
  assert.equal(environment.sources[0]?.closed, true);

  const second = new AbortController();
  capabilities.updates.subscribe(request, actions(), second.signal);
  assert.equal(environment.sources.length, 2);
  assert.equal(environment.sources[1]?.closed, false);
  second.abort();
});

test("React live updates close when pagehide fires during registration", () => {
  const environment = new FakeEnvironment();
  environment.pageHideImmediately = true;
  const controller = new AbortController();
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    actions(),
    controller.signal,
  );

  assert.equal(environment.sources[0]?.closed, true);
  assert.equal(environment.pageHideStops, 1);
  controller.abort();
  assert.equal(environment.pageHideStops, 1);
});

test("React evidence refresh validates page descriptors before store adoption", async () => {
  const environment = new FakeEnvironment();
  const next = structuredClone(catalogue);
  next.revision.evidence += 1;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: next.revision.evidence,
      updateVersion: 5,
    },
    workspace: {
      ...descriptor.workspace!,
      relatedComponents: [{ title: "Field", route: "components/field.html" }],
    },
  };
  environment.publicCatalogue = projectScopedCatalogue(next, {
    kind: "target",
    route: currentRequest().route!,
  });
  environment.responses.push(htmlResponse(environment.location.href));
  const adopted: { version: number; related: number }[] = [];
  const controller = new AbortController();
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    {
      ...actions(),
      adoptEvidence(revision) {
        adopted.push({
          version: revision.source.updateVersion,
          related: revision.workspace?.relatedComponents.length ?? 0,
        });
        return true;
      },
    },
    controller.signal,
  );
  environment.sources[0]!.emit("update", "5");
  await setImmediate();
  assert.deepEqual(adopted, [{ version: 5, related: 1 }]);
  assert.equal(environment.location.reloads, 0);
  assert.deepEqual(environment.requests, [environment.location.href]);
  controller.abort();
});

test("React evidence refresh rejects mixed public and private revisions", async () => {
  const environment = new FakeEnvironment();
  const descriptorEvidence = catalogue.revision.evidence + 1;
  const publicCatalogue = structuredClone(catalogue);
  publicCatalogue.revision.evidence = descriptorEvidence + 1;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: descriptorEvidence,
      updateVersion: 5,
    },
  };
  environment.publicCatalogue = projectScopedCatalogue(publicCatalogue, {
    kind: "target",
    route: currentRequest().route!,
  });
  environment.responses.push(htmlResponse(environment.location.href));
  let adopted = false;
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    {
      ...actions(),
      adoptEvidence() {
        adopted = true;
        return true;
      },
    },
    new AbortController().signal,
  );
  environment.sources[0]!.emit("update", "5");
  await setImmediate();
  await setImmediate();
  assert.equal(adopted, false);
  assert.equal(environment.location.reloads, 1);
});

test("React evidence refresh rejects stale, failed, and wrongly scoped pages", async (t) => {
  const cases = [
    {
      name: "stale descriptor",
      prepare(environment: FakeEnvironment) {
        environment.descriptor = descriptor;
        environment.responses.push(htmlResponse(environment.location.href));
      },
    },
    {
      name: "failed response",
      prepare(environment: FakeEnvironment) {
        environment.responses.push(
          htmlResponse(environment.location.href, undefined, false),
        );
      },
    },
    {
      name: "wrong scoped bootstrap",
      prepare(environment: FakeEnvironment) {
        environment.descriptor = {
          ...descriptor,
          source: { ...descriptor.source, updateVersion: 5 },
        };
        environment.publicCatalogue = projectScopedCatalogue(catalogue, {
          kind: "home",
        });
        environment.responses.push(htmlResponse(environment.location.href));
      },
    },
  ];
  for (const value of cases)
    await t.test(value.name, async () => {
      const environment = new FakeEnvironment();
      value.prepare(environment);
      let adopted = false;
      createReactViewerCapabilities(descriptor, environment).updates.subscribe(
        currentRequest(),
        {
          ...actions(),
          adoptEvidence() {
            adopted = true;
            return true;
          },
        },
        new AbortController().signal,
      );
      environment.sources[0]!.emit("update", "5");
      await setImmediate();
      await setImmediate();
      assert.equal(adopted, false);
      assert.equal(environment.location.reloads, 1);
      assert.deepEqual(environment.requests, [environment.location.href]);
    });
});
