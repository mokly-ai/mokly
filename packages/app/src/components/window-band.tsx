/**
 * The band at the top of a screen without a top bar. The Mac app's window has
 * no title bar, so the band is the part of the screen that moves the window.
 * It is as high as a top bar where the window reports its buttons, and it has
 * no height in a browser, where it moves no content and takes no click.
 */
export function WindowBand() {
  return <div className="fo-window-band" />;
}
