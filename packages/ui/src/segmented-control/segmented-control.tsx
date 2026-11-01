/**
 * A segmented control: a named group of segments, one of which is shown, such
 * as the viewport switch, the preview scheme switch, and the comparison modes.
 */

/** One segment: the value that it shows and its visible label. */
export type Segment<Value extends string> = readonly [
  value: Value,
  label: string,
];

/** A data attribute, such as `data-viewport-option`. */
export type DataAttribute = `data-${string}`;

/**
 * One segment of the group. A segment with an address is a link. A segment
 * without one is a toggle button that reports its value, or inert text when
 * the group is not interactive. A link or inert text names the shown segment
 * as the current page, because each segment of a static depiction is its own
 * page.
 */
function SegmentItem<Value extends string>({
  attribute,
  href,
  interactive,
  label,
  onChange,
  shown,
  value,
}: {
  attribute: DataAttribute;
  href: string | undefined;
  interactive: boolean;
  label: string;
  onChange: ((value: Value) => void) | undefined;
  shown: boolean;
  value: Value;
}) {
  const data = { [attribute]: value };
  if (href !== undefined)
    return (
      <a
        aria-current={shown ? "page" : undefined}
        {...data}
        className="mbk-reset"
        href={href}
      >
        {label}
      </a>
    );
  if (!interactive)
    return (
      <span
        aria-current={shown ? "page" : undefined}
        className="mbk-reset"
        {...data}
      >
        {label}
      </span>
    );
  return (
    <button
      aria-pressed={shown}
      {...data}
      className="mbk-reset"
      onClick={() => onChange?.(value)}
      type="button"
    >
      {label}
    </button>
  );
}

/**
 * The group of segments. Each segment carries its value in `attribute`, and
 * `mark` names the group itself, so that a stylesheet or a test can tell two
 * segmented controls apart.
 */
export function SegmentedControl<Value extends string>({
  attribute,
  href,
  interactive = true,
  label,
  mark,
  onChange,
  segments,
  value,
}: {
  /** The data attribute that carries each segment's value. */
  attribute: DataAttribute;
  /**
   * The address that shows a segment, such as another document. A segment
   * with an address is a link; the others follow `interactive`.
   */
  href?: ((value: Value) => string | undefined) | undefined;
  /**
   * Whether a segment without an address is a button, as it is by default. A
   * static depiction that runs no script sets `false`, which draws such a
   * segment as inert text.
   */
  interactive?: boolean;
  /** The accessible name of the group, such as `Viewport`. */
  label: string;
  /** An empty data attribute on the group, such as `data-mokly-viewswitch`. */
  mark?: DataAttribute;
  /** Receives the value of each segment button that the reader presses. */
  onChange?: ((value: Value) => void) | undefined;
  segments: readonly Segment<Value>[];
  /** The value of the shown segment. */
  value: Value;
}) {
  return (
    <span
      aria-label={label}
      className="mbk-seg mbk-reset"
      {...(mark === undefined ? {} : { [mark]: "" })}
      role="group"
    >
      {segments.map(([option, text]) => (
        <SegmentItem
          attribute={attribute}
          href={href?.(option)}
          interactive={interactive}
          key={option}
          label={text}
          onChange={onChange}
          shown={value === option}
          value={option}
        />
      ))}
    </span>
  );
}
