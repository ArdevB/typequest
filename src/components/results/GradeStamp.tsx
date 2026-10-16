import { forwardRef } from "react";
import type { Grade } from "@/lib/grade";

const LABEL: Record<Grade, string> = { S: "Superb", A: "Great", B: "Good", C: "Keep going" };

/** The grade "stamp". Animated in by the results timeline (GSAP). */
export const GradeStamp = forwardRef<HTMLDivElement, { grade: Grade }>(function GradeStamp({ grade }, ref) {
  return (
    <div ref={ref} className="tq-stamp" data-grade={grade} aria-label={`Grade ${grade}: ${LABEL[grade]}`}>
      <span className="tq-stamp-letter">{grade}</span>
      <span className="tq-stamp-label">{LABEL[grade]}</span>
    </div>
  );
});
