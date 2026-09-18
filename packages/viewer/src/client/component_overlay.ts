/** Overlapping cutouts form one union, so their shared pixels never become dim. */
export function createOverlay(doc: Document, width: number, height: number) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(namespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  const mask = doc.createElementNS(namespace, "mask");
  mask.id = `mbk-mask-${crypto.randomUUID()}`;
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const rectangle = (values: Record<string, string | number>) => {
    const rect = doc.createElementNS(namespace, "rect");
    for (const [key, value] of Object.entries(values))
      rect.setAttribute(key, String(value));
    return rect;
  };
  mask.append(rectangle({ width, height, fill: "white" }));
  svg.append(
    mask,
    rectangle({
      width,
      height,
      fill: "rgba(244,246,244,.72)",
      mask: `url(#${mask.id})`,
    }),
  );
  return {
    svg,
    cutout: (x: number, y: number, width: number, height: number) => {
      mask.append(rectangle({ x, y, width, height, fill: "black" }));
      svg.append(
        rectangle({
          x,
          y,
          width,
          height,
          fill: "none",
          stroke: "#336249",
          "stroke-width": 1.5,
          rx: 3,
        }),
      );
    },
  };
}
