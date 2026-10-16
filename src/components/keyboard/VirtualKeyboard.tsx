import { QWERTY, type KeyboardLayout } from "@/engine";
import { BOARD_UNITS, ansiRows, type Slot } from "./geometry";

interface Props {
  layout?: KeyboardLayout;
  className?: string;
  ariaLabel?: string;
  /** Heatmap: 0–1 per key (e.g. error rate). Keys with a value are tinted from cool to hot. */
  heat?: Readonly<Record<string, number>>;
}

const pct = (units: number) => `${(units / BOARD_UNITS) * 100}%`;

function keyLabel(slot: Slot): { main: string; top?: string } {
  if (slot.type === "mod") return { main: slot.label };
  const { key, shift } = slot.def;
  if (key === " ") return { main: "" };
  if (/^[a-z]$/.test(key)) return { main: key.toUpperCase() };
  return { main: key, top: shift };
}

/**
 * Static on-screen keyboard. Rendered once by React; highlighting is done by
 * keyboardGuide.ts through data-attributes, so typing never re-renders it.
 * Keys are colored by the finger that presses them.
 */
export function VirtualKeyboard({ layout = QWERTY, className = "", ariaLabel = "Keyboard guide", heat }: Props) {
  const rows = ansiRows(layout);
  return (
    <div className={`kb ${className}`} role="img" aria-label={ariaLabel} data-layout={layout.id} data-mode={heat ? "heat" : "guide"}>
      {rows.map((row, r) => (
        <div key={r} className="kb-row">
          {row.map((slot) => {
            const label = keyLabel(slot);
            const id = slot.type === "char" ? slot.def.key : slot.id;
            const h = slot.type === "char" && heat ? heat[slot.def.key] : undefined;
            return (
              <div
                key={id}
                className="kb-slot"
                style={{ left: pct(slot.x), width: pct(slot.width) }}
              >
                <div
                  className="kb-key"
                  data-key={slot.type === "char" ? slot.def.key : undefined}
                  data-mod={slot.type === "mod" ? slot.id : undefined}
                  data-finger={slot.finger ?? undefined}
                  data-bump={slot.type === "char" && slot.def.bump ? "true" : undefined}
                  data-heat={h !== undefined ? "true" : undefined}
                  style={h !== undefined ? ({ "--heat": `${Math.round(Math.min(1, Math.max(0, h)) * 100)}%` } as React.CSSProperties) : undefined}
                  title={h !== undefined ? `${(slot.type === "char" ? slot.def.key : "").toUpperCase()}: ${Math.round(h * 100)}% errors` : undefined}
                >
                  {label.top && <span className="kb-top">{label.top}</span>}
                  <span className="kb-main">{label.main}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
