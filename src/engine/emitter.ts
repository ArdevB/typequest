type Handler<P> = (payload: P) => void;

/** Minimal typed event emitter. Handlers run synchronously, in subscription order. */
export class Emitter<E extends { [K in keyof E]: unknown }> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(event: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => {
      set.delete(fn as Handler<never>);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as Handler<E[K]>)(payload);
      } catch (err) {
        // A broken effect must never break typing.
        console.error(`[engine] "${String(event)}" handler threw`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
