const STORAGE_KEY = "mokly.docs.tree.scrollTop";
const DESKTOP = window.matchMedia("(min-width: 768px)");

function savedScrollTop(): number | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    if (value === null) return null;
    const offset = Number(value);
    return Number.isFinite(offset) && offset >= 0 ? offset : null;
  } catch {
    return null;
  }
}

function saveScrollTop(offset: number): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(offset));
  } catch {
    return;
  }
}

function revealCurrent(tree: HTMLElement): void {
  const current = tree.querySelector<HTMLElement>('[aria-current="page"]');
  if (!current) return;
  const viewport = tree.getBoundingClientRect();
  const row = current.getBoundingClientRect();
  if (row.top < viewport.top) {
    tree.scrollTop += row.top - viewport.top;
  } else if (row.bottom > viewport.bottom) {
    tree.scrollTop += row.bottom - viewport.bottom;
  }
}

const tree = document.querySelector<HTMLElement>(
  ".site-docs-side .site-doc-tree-scroll",
);

if (tree) {
  const restore = () => {
    if (!DESKTOP.matches) return;
    const saved = savedScrollTop();
    if (saved !== null) tree.scrollTop = saved;
    revealCurrent(tree);
    saveScrollTop(tree.scrollTop);
  };

  tree.addEventListener(
    "scroll",
    () => {
      if (DESKTOP.matches) saveScrollTop(tree.scrollTop);
    },
    { passive: true },
  );
  tree.addEventListener("click", () => {
    if (DESKTOP.matches) saveScrollTop(tree.scrollTop);
  });
  DESKTOP.addEventListener("change", restore);
  restore();
}
