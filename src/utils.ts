export function throttledEventListener(
  el: HTMLElement,
  ev: keyof DocumentEventMap,
  cb: (e: Event) => void
) {
  let waiting = false;

  const f = (e: Event) => {
    if (waiting) return;
    waiting = true;

    requestAnimationFrame(() => {
      cb(e);
      waiting = false;
    });
  };

  el.addEventListener(ev, f);

  return () => el.removeEventListener(ev, f);
}
