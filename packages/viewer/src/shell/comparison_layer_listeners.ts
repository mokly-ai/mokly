/**
 * Listen to one comparison layer's presented document on behalf of its
 * section's scroll controller: the page's and every region's scroll through
 * one capturing listener, scroll keys, reader actions, the last pointer
 * target, and the loads, toggles and fonts that call for a new measurement.
 */

/** What a layer document reports to its section controller. */
export interface LayerDocumentEvents {
  /** A reader action began in the document: pointer, wheel, touch or focus. */
  acted(): void;
  /** A resource loaded, a disclosure toggled or fonts finished loading. */
  changed(): void;
  /** A key went down in the document, before its target sees it. */
  keyed(event: KeyboardEvent): void;
  /** The parser advanced; the root and body may exist now. */
  parsed(): void;
  /** The document itself or one of its elements scrolled. */
  scrolled(target: EventTarget | null): void;
}

/** One document's listeners and the last element a pointer pressed in it. */
export interface LayerDocumentListeners {
  /** The element the reader last pressed a pointer on, if any. */
  pointer(): Element | undefined;
  /** Remove every listener. */
  release(): void;
}

type Registration = [
  EventTarget,
  string,
  EventListener,
  AddEventListenerOptions,
];

function element(target: EventTarget | null): Element | undefined {
  const node = target as Partial<Node> | null;
  return node?.nodeType === 1 ? (target as Element) : undefined;
}

/** Listen to a layer document until the returned listeners are released. */
export function listenToLayerDocument(
  doc: Document,
  events: LayerDocumentEvents,
): LayerDocumentListeners {
  let pointer: Element | undefined;
  const acted = () => events.acted();
  const changed = () => events.changed();
  const parsed = () => events.parsed();
  const pressed = (event: Event) => {
    pointer = element(event.target) ?? pointer;
    events.acted();
  };
  const keyed = (event: Event) => {
    events.acted();
    events.keyed(event as KeyboardEvent);
  };
  const scrolled = (event: Event) => events.scrolled(event.target);
  const capture = { capture: true };
  const passive = { capture: true, passive: true };
  const registrations: Registration[] = [
    [doc, "readystatechange", parsed, {}],
    [doc, "scroll", scrolled, passive],
    [doc, "keydown", keyed, capture],
    [doc, "pointerdown", pressed, passive],
    [doc, "wheel", acted, passive],
    [doc, "touchstart", acted, passive],
    [doc, "focusin", acted, capture],
    [doc, "load", changed, capture],
    [doc, "toggle", changed, capture],
    [doc.fonts, "loadingdone", changed, {}],
  ];
  for (const [target, type, listener, options] of registrations)
    target.addEventListener(type, listener, options);
  return {
    pointer: () => pointer,
    release() {
      for (const [target, type, listener, options] of registrations)
        target.removeEventListener(type, listener, options);
    },
  };
}
