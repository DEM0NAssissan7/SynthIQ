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
  const [index, setIndex] = useState(BASE_INDEX + digit);
  const [animating, setAnimating] = useState(true);
  const prevDigitRef = useRef(digit);

  useEffect(() => {
    const prev = prevDigitRef.current;
    if (prev === digit) return;
    prevDigitRef.current = digit;

    let delta = digit - prev;
    if (delta > 5) delta -= 10;
    if (delta < -5) delta += 10;

    setAnimating(true);
    setIndex((curr) => curr + delta);
  }, [digit]);

  const handleTransitionEnd = () => {
    // Normalize index silently back to middle range without animation
    setAnimating(false);
    setIndex(BASE_INDEX + digit);
  };

  return (
    <span className="rolling-digit-box">
      <span
        className={`rolling-digit-strip ${animating ? "rolling-digit-strip-animating" : ""}`}
        style={{
          transform: `translateY(-${(index / DIGITS.length) * 100}%)`,
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
