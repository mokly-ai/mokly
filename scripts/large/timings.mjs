/** Keep benchmark clocks local while accepting chunked diagnostics from child processes. */
export function timingCollector(now = () => performance.now()) {
  let partial = "";
  const records = [];
  return {
    records,
    accept(chunk) {
      const decoded =
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      const lines = (partial + decoded).split("\n");
      partial = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("[mokly:timing] ")) continue;
        try {
          const event = JSON.parse(line.slice("[mokly:timing] ".length));
          if (event?.schemaVersion === 1 && typeof event.stage === "string")
            records.push({ event, receivedMs: now() });
        } catch {
          continue;
        }
      }
    },
  };
}

/** A claimed cold/warm run must actually rebuild/reuse the pinned baseline. */
export function baselineMeasurement(records, beginning, cacheHit) {
  const completed = records.filter(
    ({ event }) => event.stage === "baseline" && event.event === "end",
  );
  if (completed.length !== 1)
    throw new Error("Expected exactly one completed baseline preparation");
  const { event, receivedMs } = completed[0];
  if (
    event.status !== "ok" ||
    event.cacheHit !== cacheHit ||
    !Number.isFinite(event.durationMs)
  )
    throw new Error(
      `Expected a successful ${cacheHit ? "warm" : "cold"} baseline preparation`,
    );
  const phases = records.filter(
    ({ event: phase }) =>
      phase.session === event.session &&
      phase.parentId === event.id &&
      phase.event === "end",
  );
  if (cacheHit && phases.length)
    throw new Error("A warm baseline unexpectedly ran build phases");
  if (
    !cacheHit &&
    !phases.some(
      ({ event }) => event.stage === "baseline.adopt" && event.status === "ok",
    )
  )
    throw new Error("A cold baseline did not adopt rebuilt output");
  return {
    cacheHit,
    baselineMs: event.durationMs,
    baselineReadyMs: Math.round(receivedMs - beginning),
    preparingToPendingMs: cacheHit ? 0 : event.durationMs,
    baselinePhases: phases.map(({ event }) => ({
      stage: event.stage,
      durationMs: event.durationMs,
    })),
  };
}

/** Classification duration and the interval-union share spent on inline CSS. */
export function classificationMeasurement(records, expectedStatus = "ok") {
  const completed = records.filter(
    ({ event }) =>
      event.stage === "changes.classify" &&
      event.event === "end" &&
      event.role === "background",
  );
  if (completed.length !== 1)
    throw new Error("Expected exactly one completed background classification");
  const classification = completed[0].event;
  if (
    classification.status !== expectedStatus ||
    !Number.isFinite(classification.durationMs) ||
    !Number.isFinite(classification.elapsedMs)
  )
    throw new Error(
      `Expected background classification status ${expectedStatus}`,
    );
  const start = classification.elapsedMs - classification.durationMs;
  const end = classification.elapsedMs;
  const inline = unionDuration(
    records.flatMap(({ event }) => {
      if (
        event.session !== classification.session ||
        event.stage !== "review.inline-style-analysis" ||
        event.event !== "end" ||
        event.status !== "ok" ||
        !Number.isFinite(event.durationMs) ||
        !Number.isFinite(event.elapsedMs)
      )
        return [];
      return [
        [
          Math.max(start, event.elapsedMs - event.durationMs),
          Math.min(end, event.elapsedMs),
        ],
      ];
    }),
  );
  const classificationMs = Number(classification.durationMs.toFixed(2));
  const inlineStyleAnalysisMs = Number(inline.toFixed(2));
  return {
    classificationMs,
    inlineStyleAnalysisMs,
    inlineStyleAnalysisShare:
      classificationMs === 0
        ? 0
        : Number((inlineStyleAnalysisMs / classificationMs).toFixed(4)),
  };
}

function unionDuration(intervals) {
  const ordered = intervals
    .filter(([start, end]) => end > start)
    .sort(([left], [right]) => left - right);
  let total = 0;
  let activeStart;
  let activeEnd;
  for (const [start, end] of ordered) {
    if (activeStart === undefined) {
      activeStart = start;
      activeEnd = end;
    } else if (start <= activeEnd) activeEnd = Math.max(activeEnd, end);
    else {
      total += activeEnd - activeStart;
      activeStart = start;
      activeEnd = end;
    }
  }
  return activeStart === undefined ? 0 : total + activeEnd - activeStart;
}
