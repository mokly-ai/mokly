# Serving memory limits lack production measurements

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge notes of the deleted plans `publication-storage-scaling.md` and `cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/helm/mokly-cloud/values.yaml` and `docs/ops/environment.md`.
- **Reason:** The measurement needs real production traffic, which repository checks do not supply.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify any measurement. The chart values and the cache counters exist, but no production memory, restart or counter data is recorded.

- **Terms:**
  - **Admission bound:** A limit that refuses new work before memory runs out, such as the shared upload byte budget.
  - **Hot cache:** The catalogue server's in-memory cache of recently served publication files, `docs/protocol/cloud/catalogue-delivery.md`, "Bounded Hot Cache".
- **Background:** The storage scaling change bounded API memory with admission limits, and it added the catalogue hot cache. The cloud builds change runs the build worker inside the API process. The plans asked to check these settings under real traffic.
  - `MKC_INGEST_WORKERS`, the number of parallel ingest workers.
  - `MKC_UPLOAD_MEMORY_BYTES`, the shared upload byte budget.
  - `MKC_CATALOGUE_HOT_CACHE_BYTES`, the size of the hot cache.
  - The chart sets eight ingest workers, a 512 MiB upload budget, a 128 MiB cache, a 1.5 GiB limit for the API Deployment and 1 GiB limits for the app, the catalogue and the API jobs, in `infra/helm/mokly-cloud/values.yaml:61-98`.
  - `docs/ops/environment.md:327-367` sizes the API and catalogue memory. The catalogue headroom comes from its budget. The API breakdown comes from a local worst-case measurement of 2026-11-28, not from production use.
  - The catalogue server reports hit, miss, eviction and refusal counters for its cache.
  - The repository records no production measurement. That absence does not prove that nobody measured, and no current out-of-memory failure is known.
- **Task:** Under real traffic, measure and record the values below in `docs/ops/environment.md`. Change only the three settings above, and only within their documented ranges.
  - The API and catalogue pod memory use against both admission bounds and the hot cache.
  - The hot-cache hit rate.
  - The API's resource pressure and restart cadence while builds run.
- **Impact if no action:** Pods can run out of memory under load, or keep limits that nobody checked.
- **Needs:** Real production traffic and access to the pod metrics.
- **Done when:** The environment runbook records the measurements and the chosen values of the three settings.
- **Related:** Two choices wait for these measurements. `plans/follow-ups/hot-cache-may-not-pay-for-memory.md` decides whether the cache stays. `plans/follow-ups/build-worker-shares-api-process.md` decides where the build worker runs. This task does not make either choice.

Source: [the storage scaling post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/publication-storage-scaling.md?plain=1#L586-L607) and [the cloud builds post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plans.
