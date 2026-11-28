export function onPageExit(dispose: () => void) {
  return (event: PageTransitionEvent) => {
    if (event.persisted !== true) dispose();
  };
}
