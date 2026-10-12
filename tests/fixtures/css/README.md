# Delivered CSS Parsing Corpus

`parse-inputs.json` records every distinct input reaching either source or
built `LightningCssRuleParser.parse` while all 24 delivered `review_css_*`
test files ran at commit `b87df3a2`, before segment parsing was implemented.
It contains 334 inputs, including dynamically rendered fixture sheets, not
only statically extracted literals. Both parser prototypes were wrapped by
the capture preload; per-process sets were merged, deduplicated and sorted.
The capture run passes, and its log/preload remain under
`.context/delegation/scalable/m4-corpus-capture.log` and
`.context/delegation/scalable/capture-css-inputs.mjs`.

The segment differential replays every input under default and zero bounds,
comparing every rule field and stored derived value to the whole-input oracle.
Failure comparisons include error prototypes' names, messages, codes and nested
causes/locations; stack frames depend on the call path and are not semantic
parse data. Additional tests render real RNW sheets, compose Emotion elements
and make 1,000 reproducible edit/lexical mutations (seed printed on failure).
