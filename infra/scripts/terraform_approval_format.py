"""Print approval JSON with two-space indentation and 80-column string arrays."""

import json


def format_approval(document: dict[str, object]) -> str:
    """Keep approval objects expanded and compact string arrays when they fit."""
    return "\n".join(_lines(document, 0)) + "\n"


def _lines(
    value: object, indent: int, prefix: str = "", suffix: str = ""
) -> list[str]:
    padding = " " * indent
    if isinstance(value, dict):
        opening, closing = "{", "}"
        entries = [(json.dumps(key) + ": ", item) for key, item in value.items()]
    elif isinstance(value, list):
        if all(isinstance(item, str) for item in value):
            compact = padding + prefix + json.dumps(value) + suffix
            if len(compact) <= 80:
                return [compact]
        opening, closing = "[", "]"
        entries = [("", item) for item in value]
    else:
        return [padding + prefix + json.dumps(value) + suffix]

    lines = [padding + prefix + opening]
    for index, (child_prefix, item) in enumerate(entries):
        comma = "," if index < len(entries) - 1 else ""
        lines.extend(_lines(item, indent + 2, child_prefix, comma))
    lines.append(padding + closing + suffix)
    return lines
