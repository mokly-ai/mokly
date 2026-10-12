import { mock } from "node:test";

import { fingerprintReplayReader } from "./fingerprint_replay_reader.mjs";

mock.module("./fingerprint_replay_reader.mjs", {
  namedExports: {
    fingerprintReplayReader(reader) {
      const captured = fingerprintReplayReader(reader);
      return {
        observed: captured.observed,
        replay: {
          read: async () => {
            throw new Error("injected replay read failure");
          },
        },
      };
    },
  },
});
await import("./fingerprint_catalogue_probe.mjs");
