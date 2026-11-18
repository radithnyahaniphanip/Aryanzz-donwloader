/* ARYANZZ V1 · delegated tap feedback for buttons and interactive cards. */
(() => {
  "use strict";
  const selector = [
    "button:not(:disabled)",
    '[role="button"]:not([aria-disabled="true"])',
    "a.shortcut[href]",
    "a.ary-seo-guide-card[href]",
    "a.ary-owner2-social-card[href]"
  ].join(",");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (reducedMotion?.matches) return;

  function animateControl(target) {
    if (!(target instanceof Element)) return;
    const control = target.closest(selector);
    if (!control || control.hasAttribute("data-no-tap-effect")) return;
    control.classList.remove("ary-tap-feedback");
    void control.offsetWidth;
    control.classList.add("ary-tap-feedback");
  }

  document.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    animateControl(event.target);
  }, { passive: true });

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    animateControl(event.target);
  }, true);

  document.addEventListener("animationend", event => {
    if (event.animationName === "aryTapFeedback" || event.animationName === "aryPlatformTap") {
      event.target.classList.remove("ary-tap-feedback");
    }
  });
})();
