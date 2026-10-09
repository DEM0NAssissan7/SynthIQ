import { useEffect, useRef, useState, type CSSProperties } from "react";

interface RollingCounterProps {
  value: number | null;
  decimals?: number;
  className?: string;
  style?: CSSProperties;
}

const DIGITS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
];
const BASE_INDEX = 10;

function RollingDigitColumn({ digit }: { digit: number }) {
  const safeDigit = Math.max(0, Math.min(9, Math.floor(digit || 0)));
  const [index, setIndex] = useState(BASE_INDEX + safeDigit);
  const [animating, setAnimating] = useState(false);
  const prevDigitRef = useRef(safeDigit);

  useEffect(() => {
    const prev = prevDigitRef.current;
    if (prev === safeDigit) return;
    prevDigitRef.current = safeDigit;

    // If tab is in background or prefers reduced motion, update silently without transition
    if (
      typeof document !== "undefined" &&
      (document.hidden ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    ) {
      setAnimating(false);
      setIndex(BASE_INDEX + safeDigit);
      return;
    }

    let delta = safeDigit - prev;
    if (delta > 5) delta -= 10;
    if (delta < -5) delta += 10;

    setAnimating(true);
    setIndex((curr) => {
      const next = curr + delta;
      return Math.max(0, Math.min(DIGITS.length - 1, next));
    });

    // Safety timeout: if onTransitionEnd is skipped (backgrounded tab, dropped frame), normalize
    const timer = setTimeout(() => {
      setAnimating(false);
      setIndex(BASE_INDEX + safeDigit);
    }, 700);

    return () => clearTimeout(timer);
  }, [safeDigit]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLSpanElement>) => {
    if (e.target !== e.currentTarget) return;
    // Normalize index silently back to middle range without animation
    setAnimating(false);
    setIndex(BASE_INDEX + safeDigit);
  };

  const clampedIndex = Math.max(0, Math.min(DIGITS.length - 1, index));

  return (
    <span className="rolling-digit-box">
      <span
        className={`rolling-digit-strip ${animating ? "rolling-digit-strip-animating" : ""}`}
        style={{
          transform: `translateY(-${(clampedIndex / DIGITS.length) * 100}%)`,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {DIGITS.map((n, i) => (
          <span key={i} className="rolling-digit-item">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function RollingCounter({
  value,
  decimals = 0,
  className = "",
  style,
}: RollingCounterProps) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className={`rolling-counter ${className}`} style={style}>
        --
      </span>
    );
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted =
    decimals > 0 ? absValue.toFixed(decimals) : Math.round(absValue).toString();

  const [intPart, fracPart] = formatted.split(".");
  const intDigits = intPart.split("");

  return (
    <span
      className={`rolling-counter ${className}`}
      style={style}
      aria-label={value.toFixed(decimals)}
    >
      {isNegative && <span className="rolling-char">-</span>}

      {intDigits.map((char, i) => {
        const placeFromRight = intDigits.length - 1 - i;
        const d = parseInt(char, 10);
        return (
          <RollingDigitColumn
            key={`int-${placeFromRight}`}
            digit={isNaN(d) ? 0 : d}
          />
        );
      })}

      {decimals > 0 && fracPart !== undefined && (
        <>
          <span className="rolling-char">.</span>
          {fracPart.split("").map((char, i) => {
            const d = parseInt(char, 10);
            return (
              <RollingDigitColumn
                key={`frac-${i}`}
                digit={isNaN(d) ? 0 : d}
              />
            );
          })}
        </>
      )}
    </span>
  );
}
