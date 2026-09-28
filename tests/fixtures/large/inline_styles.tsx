import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

const ownerStyles = new Map<string, ViewStyle>();
const renderedStyles = new Map<string, ViewStyle>();

function areaNumber(area: string): number {
  const value = Number(area.slice("area-".length));
  return Number.isSafeInteger(value) ? value : 0;
}

function ownerStyle(area: string): ViewStyle {
  const existing = ownerStyles.get(area);
  if (existing) return existing;
  const index = areaNumber(area);
  const owner: ViewStyle = {
    borderColor:
      area === "area-1" ? "rgb(1, 2, 3)" : `rgb(${20 + index}, 2, 3)`,
    borderStyle: "solid",
    borderWidth: 0,
  };
  const style = StyleSheet.create({ owner }).owner;
  ownerStyles.set(area, style);
  return style;
}

function renderedStyle(area: string, token: string): ViewStyle {
  const key = `${area}/${token}`;
  const existing = renderedStyles.get(key);
  if (existing) return existing;
  const style = StyleSheet.create({
    rendered: { zIndex: 1_000 + renderedStyles.size },
  }).rendered;
  renderedStyles.set(key, style);
  return style;
}

/** Register stable owner and per-view atomic rules in the global RNW sheet. */
export function InlineActionStyle({
  area,
  children,
  token,
}: {
  area: string;
  children: ReactNode;
  token: string;
}) {
  return (
    <View style={[ownerStyle(area), renderedStyle(area, token)]}>
      {children}
    </View>
  );
}
