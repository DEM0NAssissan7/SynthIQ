import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import MdIcon from "./MdIcon";

export interface MdModalBottomSheetProps {
  show: boolean;
  onHide: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  dragUpY?: number | null;
}

export default function MdModalBottomSheet({
  show,
  onHide,
  title,
  children,
  className = "",
  dragUpY = null,
}: MdModalBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragDownY, setDragDownY] = useState<number | null>(null);
  const dragDownStartRef = useRef<{ y: number; time: number } | null>(null);

  // Dynamic measurement of sheet height
  const [sheetHeight, setSheetHeight] = useState(600);
  useEffect(() => {
    if (sheetRef.current) {
      const h = sheetRef.current.offsetHeight;
      if (h > 0) setSheetHeight(h);
    }
  }, [show, children]);

  // Lock body scroll and handle Escape key while open or dragging
  useEffect(() => {
    if (show) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onHide();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [show, onHide]);

  // Pointer event handlers for dragging the sheet downwards to dismiss
  const handleTopPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragDownStartRef.current = { y: e.clientY, time: Date.now() };
  };

  const handleTopPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragDownStartRef.current) return;
    const dy = e.clientY - dragDownStartRef.current.y;
    if (dy > 0) {
      setDragDownY(dy);
    } else {
      setDragDownY(0);
    }
  };

  const handleTopPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragDownStartRef.current) return;
    const start = dragDownStartRef.current;
    dragDownStartRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const dy = e.clientY - start.y;
    const dt = Math.max(1, Date.now() - start.time);
    const velocity = dy / dt; // downward velocity in px/ms

    if (dy > 80 || velocity > 0.4) {
      onHide();
    }
    setDragDownY(null);
  };

  const handleTopPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragDownStartRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    dragDownStartRef.current = null;
    setDragDownY(null);
  };

  // Determine gesture states
  const isDraggingUp = dragUpY !== null && dragUpY > 0;
  const isDraggingDown = dragDownY !== null && dragDownY > 0;
  const isDragging = isDraggingUp || isDraggingDown;
  const isVisible = show || isDraggingUp;

  // Calculate dynamic transform and backdrop opacity when dragging
  let translateY: number | null = null;
  let backdropOpacity: number | null = null;

  if (isDraggingUp) {
    const upward = dragUpY ?? 0;
    const effectiveHeight = sheetHeight || (window.innerHeight * 0.82);
    translateY = Math.max(0, effectiveHeight - upward);
    backdropOpacity = Math.min(0.5, (upward / (effectiveHeight * 0.7)) * 0.5);
  } else if (isDraggingDown) {
    const downward = dragDownY ?? 0;
    const effectiveHeight = sheetHeight || (window.innerHeight * 0.82);
    translateY = downward;
    backdropOpacity = Math.max(0, (1 - downward / (effectiveHeight * 0.8)) * 0.5);
  }

  return (
    <div
      className={`md3-sheet-wrapper ${isVisible ? "visible" : ""}`}
      aria-hidden={!isVisible}
    >
      {/* Dimmed Backdrop */}
      <div
        className={`md3-sheet-backdrop ${show ? "open" : ""} ${isDragging ? "dragging" : ""}`}
        style={backdropOpacity !== null ? { opacity: backdropOpacity } : undefined}
        onClick={onHide}
        aria-hidden="true"
      />

      {/* Material 3 Bottom Sheet Container */}
      <div
        ref={sheetRef}
        className={`md3-bottom-sheet ${show ? "open" : ""} ${isDragging ? "dragging" : ""} ${className}`.trim()}
        style={translateY !== null ? { transform: `translateY(${translateY}px)` } : undefined}
        role="dialog"
        aria-modal="true"
      >
        {/* M3 Centered Drag Handle (touch/drag to pull down or tap to close) */}
        <div
          className="md3-sheet-handle-wrap"
          onPointerDown={handleTopPointerDown}
          onPointerMove={handleTopPointerMove}
          onPointerUp={handleTopPointerUp}
          onPointerCancel={handleTopPointerCancel}
          onClick={onHide}
          role="button"
          tabIndex={0}
          aria-label="Drag down to close sheet"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onHide();
            }
          }}
        >
          <div className="md3-sheet-handle" />
        </div>

        {/* Sheet Header with title & close button */}
        {title && (
          <div
            className="md3-sheet-header"
            onPointerDown={handleTopPointerDown}
            onPointerMove={handleTopPointerMove}
            onPointerUp={handleTopPointerUp}
            onPointerCancel={handleTopPointerCancel}
          >
            <div className="md3-sheet-title">{title}</div>
            <button
              type="button"
              className="md3-sheet-close-btn"
              onClick={onHide}
              aria-label="Close"
            >
              <MdIcon name="close" size={20} />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="md3-sheet-body">{children}</div>
      </div>
    </div>
  );
}
