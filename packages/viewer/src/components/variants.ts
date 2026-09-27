/** Expand one pre-v7 local saved id into the component's global id namespace. */
export function legacyComponentVariantId(
  componentId: string,
  variantId: string,
): string {
  return variantId.startsWith(`${componentId}-`)
    ? variantId
    : `${componentId}-${variantId}`;
}
