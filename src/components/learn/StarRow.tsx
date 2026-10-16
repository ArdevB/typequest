import { forwardRef } from "react";

interface Props {
  stars: number;
  size?: number;
  className?: string;
}

/** Three stars, `stars` of them filled. Each star is a child the results screen animates. */
export const StarRow = forwardRef<HTMLDivElement, Props>(function StarRow({ stars, size = 16, className = "" }, ref) {
  return (
    <div ref={ref} className={`flex items-center gap-[0.15em] ${className}`} aria-label={`${stars} of 3 stars`} role="img">
      {[1, 2, 3].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="tq-star" data-on={i <= stars} aria-hidden="true">
          <path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" />
        </svg>
      ))}
    </div>
  );
});
