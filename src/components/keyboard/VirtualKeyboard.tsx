import { QWERTY, type KeyboardLayout } from "@/engine";
import { BOARD_UNITS, ansiRows, type Slot } from "./geometry";

interface Props {
  layout?: KeyboardLayout;
  className?: string;
  /** Optional label under each key (e.g. a heatmap value). */
  ariaLabel?: string;
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
export function VirtualKeyboard({ layout = QWERTY, className = "", ariaLabel = "Keyboard guide" }: Props) {
  const rows = ansiRows(layout);
  return (
    <div className={`kb ${className}`} role="img" aria-label={ariaLabel} data-layout={layout.id}>
      {rows.map((row, r) => (
        <div key={r} className="kb-row">
          {row.map((slot) => {
            const label = keyLabel(slot);
            const id = slot.type === "char" ? slot.def.key : slot.id;
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
