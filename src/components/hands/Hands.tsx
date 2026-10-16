import { forwardRef } from "react";
import type { FingerId } from "@/components/keyboard/geometry";

/**
 * Two stylized hands drawn on the same horizontal scale as <VirtualKeyboard/>
 * (40 SVG units per key), so each finger sits under its home key.
 * keyboardGuide.ts lights the active finger and leans it toward the target key
 * via data-active and the --dx / --dy custom properties.
 */

const W = 600;
const MIRROR = 540; // left and right home keys are symmetric around x = 270
const BASE = 122;

interface FingerSpec {
  finger: "pinky" | "ring" | "middle" | "index";
  cx: number;
  length: number;
}

const LEFT: FingerSpec[] = [
  { finger: "pinky", cx: 90, length: 60 },
  { finger: "ring", cx: 130, length: 80 },
  { finger: "middle", cx: 170, length: 90 },
  { finger: "index", cx: 210, length: 80 },
];

function Finger({ id, cx, length }: { id: FingerId; cx: number; length: number }) {
  const w = 30;
  const top = BASE - length;
  return (
    <g className="hand-finger" data-finger={id}>
      <g className="finger-press">
        <rect className="finger-body" x={cx - w / 2} y={top} width={w} height={length + 26} rx={w / 2} />
        <rect className="finger-nail" x={cx - 8} y={top + 5} width={16} height={14} rx={6} />
      </g>
    </g>
  );
}

function Thumb({ id, mirror }: { id: FingerId; mirror: boolean }) {
  const cx = mirror ? MIRROR - 222 : 222;
  const angle = mirror ? -32 : 32;
  return (
    <g className="hand-finger" data-finger={id}>
      <g className="finger-press">
        <g transform={`rotate(${angle} ${cx} 168)`}>
          <rect className="finger-body" x={cx - 15} y={116} width={30} height={70} rx={15} />
          <rect className="finger-nail" x={cx - 8} y={121} width={16} height={14} rx={6} />
        </g>
      </g>
    </g>
  );
}

function Hand({ side }: { side: "l" | "r" }) {
  const mirror = side === "r";
  const x = (v: number) => (mirror ? MIRROR - v : v);
  const palmLeft = mirror ? x(234) : 66;
  return (
    <g className="hand" data-hand={side}>
      <rect className="hand-palm" x={palmLeft} y={104} width={168} height={92} rx={36} />
      <Thumb id={`${side}-thumb`} mirror={mirror} />
      {LEFT.map((f) => (
        <Finger key={f.finger} id={`${side}-${f.finger}`} cx={x(f.cx)} length={f.length} />
      ))}
    </g>
  );
}

export const Hands = forwardRef<SVGSVGElement, { className?: string }>(function Hands({ className = "" }, ref) {
  return (
    <svg ref={ref} className={`hands ${className}`} viewBox={`0 0 ${W} 172`} aria-hidden="true" preserveAspectRatio="xMidYMin meet">
      <Hand side="l" />
      <Hand side="r" />
    </svg>
  );
});
