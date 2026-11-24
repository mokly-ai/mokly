# Canvas redesign is unchecked on real phones and Safari

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-24, from the post-merge tasks of the deleted Canvas
  redesign plan, on the branch `calummoore/mokly-website-redesign-plan-af84`
  (PR #488).
- **Location:** None.
- **Reason:** The check needs the deployed site and app and real devices,
  which the browser tests do not provide.

- **Terms:**
  - **Canvas:** the design that the site, the open-source viewer and the
    Mokly Cloud viewer now share. Pages and the viewer stage draw on a
    dot-grid canvas, with Geist type and one signal green, in a light and a
    dark scheme.
  - **Compact layout:** the viewer below 900px. It shows one frame, a frame
    picker, a dock and bottom sheets in place of the floating panels.
- **Background:**
  - The browser tests run in Chromium only, at fixed widths. No test runs
    WebKit, Safari, or a real phone with touch, a soft keyboard, safe areas
    or dynamic toolbars.
  - The parts most likely to differ there:
    - The viewer canvas: pan, zoom and fit by pointer, wheel and trackpad.
      The touch pinch over a frame is not built yet, as
      `plans/follow-ups/canvas-touch-pinch-over-frames.md` says.
    - The compact layout's dock and bottom sheets, and the 44px touch
      targets of the phone menus.
    - The site's footer scheme control, which stores the choice under
      `mokly.site.scheme`, and the home demos, which honour reduced motion.
    - The self-hosted Geist, Geist Mono and Instrument Serif fonts.
    - The cloud viewer's account menu with Theme, Settings, Docs, Changelog
      and Sign out, which the phone's More menu repeats.
- **Task:**
  - Open the deployed site at `/`, `/docs/`, `/changelog/`, `/pricing/` and
    `/terms/` on a real iPhone in Safari and on a real Android phone in
    Chrome, in the light and the dark scheme.
  - Open the deployed app's viewer on a branch publication on the same
    phones, and in Safari on a Mac. Pan, zoom, fit, open each compare mode,
    open the dock's sheets, and use the account menu.
  - Record each defect as a follow-up item, or fix it.
- **Impact if no action:** A layout, input or font defect that only
  WebKit or a real phone shows reaches readers unseen.
- **Needs:** The deployed site and app, a real iPhone, a real Android phone
  and a Mac with Safari.
- **Done when:** A dated result names the deployed site and app revisions,
  the devices and browsers, and each defect found with its item or fix.
