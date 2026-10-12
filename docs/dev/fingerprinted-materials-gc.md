# M9 Full-Worker GC Diagnostics

The production-worker trace pair records much more major GC in M9 at almost
identical allocation volume: 371 mark-compacts / 9.46 s against M8's 86 / 3.06 s.
Forced-GC checkpoints show a small, stable live-heap difference, not accumulating
page retention. The accompanying [ablation report](./fingerprinted-materials-worker-ablation.md) determines which M9 group
recovers classification time. Neither diagnostic pair is an acceptance sample.

## Capture

Both runs use the full cumulative component-style cold benchmark, including real
fixture preparation, background rendering and prepared readers. M8 is `5e5111dc`;
M9 code is `14447151` at documentation-only HEAD `5ea98bf4`. Same Xeon @ 2.90 GHz,
eight CPUs, 2899.962 MHz, Node 24.19.0 and system Chrome 153.0.8010.52. CPU/MHz,
uptime, memory and steal snapshots precede each run. The worker retains the
production 1,024 MiB old-generation limit and the normal 900,000 ms delivery cap.

An uncommitted preload enables V8 trace-gc/nvp/verbose only across the worker's
`changes.classify` interval. Worker-local GC PerformanceObserver entries are
paired one-to-one with native records by PID, isolate and thread ID; parent and
other worker collections are excluded. Each major's old-space used/committed
size comes from the native post-collection space report, not an asynchronous
observer callback's later heap. Calibration matched all five minor and three
major collections and checked the final old-space value against V8 heap stats.
An unrelated-worker preflight confirms it does not load this preload.

Only classification start/end and count events are parsed/retained in the worker.
The full comparison result is hashed after its timer ends. Both runs return the
same result hash, all 5,520 views on the style route, exact membership, 5,698
segment parses and shared integer work counts. Both fixtures are restored and
hash-checked. Engine trees stay clean. No runtime code or contract is edited.

## Natural Collections

Observer duration includes the enabled tracing overhead. Native rounded pause
totals are also retained: scavenges 4,024.5 / 2,977.2 ms, mark-compacts
3,050.0 / 9,415.5 ms, M8 / M9. Allocated bytes are summed native counters; the
first collection can include allocations preceding the classification boundary.
The measured allocation ratio is 1.001733. Major flags are 40 on 14 collections
on both trees, and 64 on 72 M8 / 357 M9 collections. Raw records preserve flags
without treating them as proof of which source allocation caused collection.

| Worker | Scavenges | Observer pause ms | Mark-compacts | Observer pause ms | Allocated bytes |
| ------ | --------- | ----------------- | ------------- | ----------------- | --------------- |
| M8     | 1117      | 4139.61           | 86            | 3062.09           | 80439351528     |
| M9     | 903       | 3063.22           | 371           | 9462.01           | 80578745536     |

Post-mark-compact old-space usage, KiB, in collection order:

M8 (86 collections):

```text
001–012: 63920, 69090, 69144, 69275, 69382, 69398, 69581, 69818, 69886, 70011, 70171, 70223
013–024: 70236, 70366, 70476, 69016, 79090, 76169, 83107, 83665, 79301, 86826, 87924, 78865
025–036: 79275, 79059, 82288, 84480, 85064, 82167, 82711, 87203, 88028, 82618, 83020, 83305
037–048: 84918, 83773, 87754, 86957, 83961, 85671, 87205, 85178, 85676, 85835, 84387, 86383
049–060: 86656, 86911, 85519, 86434, 87742, 87887, 87919, 88127, 88302, 88229, 88604, 88551
061–072: 88754, 89699, 89872, 89579, 89956, 90127, 90406, 90470, 90852, 91081, 91363, 91502
073–084: 91794, 90329, 92224, 92176, 92458, 92855, 92948, 91499, 93233, 93517, 93850, 94077
085–086: 94152, 94465
```

M9 (371 collections):

```text
001–012: 64006, 69191, 69168, 69216, 69459, 69558, 69672, 69913, 69977, 70106, 70257, 70314
013–024: 70326, 70456, 70567, 70255, 77870, 80143, 74606, 81950, 83391, 81220, 74802, 83898
025–036: 79212, 84347, 77817, 84283, 82094, 88478, 75582, 87810, 79964, 83741, 84712, 84118
037–048: 84824, 80024, 91222, 85553, 86368, 85414, 86308, 91264, 85723, 86193, 86304, 87048
049–060: 91550, 94752, 78461, 91112, 83449, 90460, 87028, 93370, 79258, 91294, 84814, 85946
061–072: 85829, 85225, 91422, 84617, 85706, 84249, 85648, 85674, 86438, 86268, 93435, 86803
073–084: 88407, 85787, 87124, 81442, 93951, 80930, 87662, 87053, 86832, 81428, 87032, 88540
085–096: 88126, 88562, 88744, 82786, 87946, 87847, 87903, 87532, 88233, 88178, 88315, 88891
097–108: 88845, 82387, 83650, 88516, 82512, 88858, 89411, 87655, 88708, 85148, 83420, 89404
109–120: 88988, 89138, 89173, 83894, 89188, 89708, 89669, 88308, 89406, 89525, 89247, 81647
121–132: 89729, 89771, 90141, 83842, 90155, 90271, 90275, 90600, 84283, 89430, 90140, 90076
133–144: 86269, 89497, 84437, 88460, 88694, 87954, 84710, 84890, 85615, 84365, 88742, 85434
145–156: 84925, 85150, 85159, 84798, 87543, 86993, 84993, 84999, 88062, 87921, 86513, 86919
157–168: 86748, 86099, 86505, 89031, 89399, 86625, 88378, 86732, 84555, 86026, 86063, 85992
169–180: 83548, 87152, 87203, 86464, 84450, 83782, 86004, 87816, 87853, 87559, 87073, 86580
181–192: 86655, 87034, 88232, 86765, 87127, 86824, 86642, 87269, 87310, 86852, 86784, 87156
193–204: 87190, 87528, 87525, 87187, 87326, 87138, 87186, 87245, 87886, 87328, 87371, 87408
205–216: 88075, 87512, 86125, 85283, 87754, 87696, 88356, 87861, 88166, 87986, 87806, 86579
217–228: 88048, 88411, 88198, 88520, 88570, 88624, 88338, 88405, 88802, 88473, 88562, 88491
229–240: 88401, 88445, 88805, 88857, 88457, 88606, 86970, 88660, 88746, 89166, 88547, 88697
241–252: 89281, 87466, 89369, 88980, 89368, 87928, 89451, 89929, 89970, 88052, 89510, 90081
253–264: 90155, 89803, 86968, 88902, 90372, 89943, 89985, 90038, 90075, 90584, 90213, 89940
265–276: 90292, 90194, 90363, 90385, 90891, 90948, 90442, 90574, 91076, 90214, 90850, 90425
277–288: 90868, 90944, 90918, 90987, 90386, 91164, 91237, 91154, 91353, 91732, 89620, 91163
289–300: 91392, 89806, 90496, 91985, 91671, 91221, 91436, 91603, 91675, 91595, 91785, 91969
301–312: 91754, 91845, 91639, 92090, 91902, 92159, 92172, 91530, 92222, 92345, 92570, 92415
313–324: 91440, 90770, 92273, 91818, 92586, 92624, 92548, 92732, 92813, 92824, 90539, 92951
325–336: 92743, 91929, 93038, 92930, 90642, 92239, 92583, 92956, 93284, 93144, 93363, 91667
337–348: 93465, 93332, 93566, 92477, 93449, 93690, 92643, 93740, 91367, 93827, 93906, 92080
349–360: 92874, 93980, 94069, 92757, 94096, 94110, 94198, 94307, 91461, 93670, 94372, 93344
361–371: 94436, 92679, 92689, 92018, 94572, 92747, 92845, 94662, 94165, 93801, 94321
```

| Worker | Initial used heap MiB | Initial capacity MiB | Final used heap MiB | Final external MiB |
| ------ | --------------------- | -------------------- | ------------------- | ------------------ |
| M8     | 70.11                 | 275.64               | 201.38              | 1280.27            |
| M9     | 799.57                | 965.43               | 181.60              | 1280.27            |

The diagnostic worker durations are 221,074.89 ms M8 and 224,016.83 ms M9. These
are traced timings and do not replace the earlier unprofiled regression. More
major collections do not alone prove more live retention: the post-collection
old-space values overlap substantially. The much larger M9 entry heap also
requires distinguishing uncollected compilation garbage from reachable data.

## Forced-GC Checkpoints

A second M8-then-M9 production pair exposes synchronous GC through a test-only
VM context. It collects at entry (view 0, added to distinguish compilation
history) and after each 500 completed views. An uncommitted loader attaches the
checkpoint to the existing compared-view counter. Both trees use the same
intervention. There is no tracing or CPU profiling. These interventions reset
GC cadence and alter execution; their durations are not ordinary timing samples.

| Views | M8 live heap MiB | M9 live heap MiB | M9 - M8 MiB |
| ----- | ---------------- | ---------------- | ----------- |
| 0     | 37.801           | 38.589           | +0.787      |
| 500   | 64.995           | 65.025           | +0.031      |
| 1000  | 66.674           | 69.021           | +2.347      |
| 1500  | 68.140           | 70.455           | +2.315      |
| 2000  | 69.457           | 71.763           | +2.306      |
| 2500  | 70.885           | 73.186           | +2.300      |
| 3000  | 72.436           | 74.795           | +2.359      |
| 3500  | 73.681           | 76.026           | +2.346      |
| 4000  | 75.126           | 77.427           | +2.300      |
| 4500  | 76.583           | 78.980           | +2.397      |
| 5000  | 77.824           | 80.146           | +2.322      |
| 5500  | 79.680           | 82.007           | +2.326      |

Uncollected entry heaps were 737.16 / 739.36 MiB in this pair, M8 / M9; forced GC
reduced them to 37.80 / 38.59 MiB. This demonstrates that the large entry heap is
mostly collectible compilation garbage and can occur on either version.

From 1,000 through 5,500 views, M9's excess is 2.30–2.40 MiB. At 5,500 views,
2.2464 MiB is in large-object space and only 0.0946 MiB in old space; external
memory differs by 0.21 MiB. Object identity is not established by space totals.
The constant difference does not support a large per-view retention leak.

The forced pair classifies in 205,337.69 / 201,075.63 ms, including 489.82 /
644.94 ms of explicit GC pauses. M9 is faster under this intervention, supporting
GC cadence/runtime state as a contributor, but this is one diagnostic pair and
not a causal attribution to a particular M9 change. Results, route counts and
fixture restoration still match exactly. CPU cgroup limits are unrestricted and
its throttling counters are zero; this check cannot exclude every host effect.

## Evidence

All tooling and raw data are uncommitted in
`.context/delegation/scalable/m9-full-worker-ablation/`. `gc-{m8,m9}.worker.json`
contains scoped observer entries and heap boundaries; `.gc-events.json`,
`.gc-summary.json`, `.mark-compacts.csv` and raw `.log` siblings retain every
collection and post-major space reading. The ordered KiB lists above include
every major. `gc-worker-preload.mjs` preserves the exact natural-trace preload.

`forced-{m8,m9}.worker.json` and `forced-summary.json` retain all 12 checkpoints,
space breakdowns and pause times. Commands, host snapshots, complete result
records and restoration hash manifests accompany every sample. Drivers tolerate
exit 1 only for the separate five-second startup target when classification is
successful; all four diagnostics have that startup-budget failure. No sample
is incomplete. The gate and push remain blocked pending the supervisor's decision.
