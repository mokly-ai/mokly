# Large Consumer Fixture

Status: In progress under the [Rust rebuild plan](../../../plans/rust-rebuild.md).

The scale fixture represents a catalogue with thousands of screens. It has
HTML and React variants. Both variants use the same entry paths, viewports,
colour schemes, component usage, slots, pages, use cases, documents, styles,
and images.

The [scale contract](../../../docs/protocol/mokly-timings.md#scale-fixture)
defines the generator, its four benchmark scenarios, the baseline edit, and
the time and memory evidence. Generated fixture files live outside the authored
example catalogue. A small instance checks correctness in automated tests.
The opt-in benchmark measures the full instance with other heavy work idle.

The [reference capture procedure](../../../docs/protocol/rust-rebuild-procedures.md#reference-capture)
defines the old-backend captures used to review behaviour differences.
