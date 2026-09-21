import { useEffect, useRef, useState } from "react";

/**
 * The pixel width of an element. Charts draw into a viewBox, so without this
 * a chart that spans two columns would scale its own text up with it.
 */
export function useWidth(fallback = 540) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
