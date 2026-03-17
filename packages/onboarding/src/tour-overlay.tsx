import { useEffect, useState, type CSSProperties } from "react";
import { useTour } from "./tour-provider";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Full-viewport overlay with a spotlight cutout around the current tour target.
 * Uses box-shadow to darken everything except the highlighted element.
 */
export function TourOverlay() {
  const { isActive, currentStep } = useTour();
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!isActive || !currentStep) {
      setRect(null);
      return;
    }

    function measure() {
      const el = document.querySelector(currentStep!.targetSelector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
    }

    // Initial measure
    measure();

    // Re-measure on resize / scroll
    const ro = new ResizeObserver(measure);
    const target = document.querySelector(currentStep.targetSelector);
    if (target) ro.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isActive, currentStep]);

  if (!isActive || !rect) return null;

  const padding = 8; // px of breathing room around the target
  const spotlightStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 9998,
    pointerEvents: "none",
  };

  // Cutout via box-shadow — the spotlight is a transparent hole
  const cutoutStyle: CSSProperties = {
    position: "absolute",
    top: rect.top - window.scrollY - padding,
    left: rect.left - window.scrollX - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: 8,
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
    transition: "all 0.3s ease",
  };

  return (
    <div style={spotlightStyle} aria-hidden>
      <div style={cutoutStyle} />
    </div>
  );
}
