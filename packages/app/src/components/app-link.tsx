import { useRouter } from "expo-router";
import { useCallback } from "react";
import type { MouseEvent, ReactNode, RefObject } from "react";

/**
 * An in-app destination is a real anchor with a real href, so it is readable,
 * focusable and openable in a new tab, and a plain click stays inside the
 * running application instead of reloading it.
 */
export function AppLink({
  href,
  className,
  children,
  current,
  label,
  linkRef,
  onPress,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  current?: boolean;
  label?: string;
  linkRef?: RefObject<HTMLAnchorElement | null>;
  /** Takes the destination's place, for a link a guard has to answer first. */
  onPress?: () => void;
}) {
  const router = useRouter();
  const press = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      if (onPress) {
        onPress();
        return;
      }
      router.push(href);
    },
    [href, router, onPress],
  );
  return (
    <a
      ref={linkRef}
      href={href}
      className={className}
      aria-current={current ? "page" : undefined}
      aria-label={label}
      onClick={press}
    >
      {children}
    </a>
  );
}
