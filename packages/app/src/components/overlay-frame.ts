import type { ViewStyle } from "react-native";

/**
 * The registered panel frame's geometry, which every overlay the product opens
 * shares: a centered card at most `maxWidth` wide and 76vh tall on a pointer
 * surface, and a bottom sheet flush to the edge, 16px on its top corners only
 * and at most 84vh, on a compact one. The package's modal frame draws either.
 */
export function overlaySurface(compact: boolean, maxWidth: number): ViewStyle {
  return compact
    ? {
        width: "100%",
        maxHeight: "84vh" as unknown as number,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      }
    : {
        maxWidth,
        width: "100%",
        maxHeight: "76vh" as unknown as number,
        borderRadius: 10,
      };
}

/**
 * The frame's own header is not drawn: the overlay's bar carries its single
 * title and its own control, so the frame renders only the target its
 * `aria-labelledby` points at, hidden from view and from assistive technology.
 */
export const hiddenFrameHeader: ViewStyle = { display: "none" };

/**
 * A React Native view does not shrink by default, so the frame's body is told
 * it may: otherwise it grows to its content and the overlay's own scroll
 * region never engages inside the capped surface.
 */
export const overlayFrameBody: ViewStyle = {
  padding: 0,
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
};
