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
  const recordedStart = records.find(
    ({ event }) =>
      event.stage === "changes.classify" &&
      event.event === "start" &&
      event.role === "background" &&
      event.session === classification.session &&
      event.id === classification.id,
  );
  const start =
    recordedStart?.event.elapsedMs ??
    classification.elapsedMs - classification.durationMs;
  const end = classification.elapsedMs;
  const inline = unionDuration(
    records.flatMap(({ event }) => {
      if (
        event.session !== classification.session ||
        event.stage !== "review.inline-style-analysis" ||
        event.event !== "end" ||
        !["ok", "error"].includes(event.status) ||
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
  const cssAnalysisMs = rounded(
    stageDuration(
      records,
      classification.session,
      "review.css-analysis",
      start,
      end,
    ),
  );
  return {
    classificationMs,
    inlineStyleAnalysisMs,
    inlineStyleAnalysisShare:
      classificationMs === 0
        ? 0
        : Number((inlineStyleAnalysisMs / classificationMs).toFixed(4)),
    cssAnalysisMs,
    cssAnalysisShare:
      classificationMs === 0
        ? 0
        : Number((cssAnalysisMs / classificationMs).toFixed(4)),
  };
}

/** A unique worker start without an end is incomplete, not a failed completed span. */
export function classificationEvidence(records, stopRequestedMs) {
  const worker = records.filter(
    ({ event }) =>
      event.stage === "changes.classify" && event.role === "background",
  );
  const starts = worker.filter(({ event }) => event.event === "start");
  const ends = worker.filter(({ event }) => event.event === "end");
  if (!starts.length && !ends.length) return {};
  if (starts.length > 1 || ends.length > 1)
    throw new Error("Missing or ambiguous background classification spans");
  const classification = (ends[0] ?? starts[0]).event;
  if (
    starts[0] &&
    (starts[0].event.session !== classification.session ||
      starts[0].event.id !== classification.id)
  )
    throw new Error("Background classification start/end do not pair");
  if (!Number.isFinite(classification.elapsedMs))
    throw new Error("Invalid background classification clock");
  const start =
    starts[0]?.event.elapsedMs ??
    classification.elapsedMs - classification.durationMs;
  const end = ends[0]?.event.elapsedMs ?? Infinity;
  if (!Number.isFinite(start) || end < start)
    throw new Error("Invalid background classification interval");
  const counts = completedCounts(records, classification.session, start, end);
  if (ends.length) {
    if (
      !["ok", "error"].includes(classification.status) ||
      !Number.isFinite(classification.durationMs) ||
      classification.durationMs < 0
    )
      throw new Error("Invalid completed classification status/duration");
    return {
      classificationStatus: classification.status,
      ...classificationMeasurement(records, classification.status),
      ...counts,
    };
  }
  const result = {
    classificationStatus: "incomplete",
    inlineStyleAnalysisLowerBoundMs: rounded(
      stageDuration(
        records,
        classification.session,
        "review.inline-style-analysis",
        start,
        Infinity,
      ),
    ),
    cssAnalysisLowerBoundMs: rounded(
      stageDuration(
        records,
        classification.session,
        "review.css-analysis",
        start,
        Infinity,
      ),
    ),
    ...counts,
  };
  const waits = records.filter(
    ({ event }) => event.stage === "changes.classify" && event.role === "serve",
  );
  const completed = waits.filter(({ event }) => event.event === "end");
  if (completed.length === 1 && Number.isFinite(completed[0].event.durationMs))
    result.classificationUpperBoundMs = rounded(completed[0].event.durationMs);
  else if (completed.length === 0) {
    const begun = waits.filter(({ event }) => event.event === "start");
    if (
      begun.length === 1 &&
      Number.isFinite(stopRequestedMs) &&
      Number.isFinite(begun[0].receivedMs) &&
      stopRequestedMs >= begun[0].receivedMs
    )
      result.classificationWaitUntilStopMs = rounded(
        stopRequestedMs - begun[0].receivedMs,
      );
  }
  return result;
}

function completedCounts(records, session, start, end) {
  const result = {};
  for (const [stage, name] of [
    ["review.document-work", "documentWork"],
    ["review.inline-style-analysis", "inlineStyleCounts"],
    ["review.compare-screens", "comparisonCounts"],
  ]) {
    const found = records.filter(
      ({ event }) =>
        event.session === session &&
        event.stage === stage &&
        event.event === "counts" &&
        event.elapsedMs >= start &&
        event.elapsedMs <= end,
    );
    if (found.length > 1) throw new Error(`Ambiguous ${stage} counts`);
    if (found[0]?.event.counts) result[name] = found[0].event.counts;
  }
  if (Number.isFinite(result.comparisonCounts?.heapPeakMiB))
    result.heapPeakMiB = result.comparisonCounts.heapPeakMiB;
  return result;
}

function stageDuration(records, session, stage, start, end) {
  return unionDuration(
    records.flatMap(({ event }) =>
      event.session === session &&
      event.stage === stage &&
      event.event === "end" &&
      ["ok", "error"].includes(event.status) &&
      Number.isFinite(event.elapsedMs) &&
      Number.isFinite(event.durationMs) &&
      event.durationMs >= 0
        ? [
            [
              Math.max(start, event.elapsedMs - event.durationMs),
              Math.min(end, event.elapsedMs),
            ],
          ]
        : [],
    ),
  );
}

function rounded(value) {
  return Number(value.toFixed(2));
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
