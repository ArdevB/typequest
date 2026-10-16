"use client";

import { AnimatePresence, motion } from "motion/react";
import { useToasts } from "@/stores/toastStore";

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismiss(t.id)}
            className="tq-toast pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-left shadow-2xl"
            data-tone={t.tone ?? "info"}
          >
            <p className="font-medium text-text">{t.title}</p>
            {t.body && <p className="mt-0.5 text-sm text-sub">{t.body}</p>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
