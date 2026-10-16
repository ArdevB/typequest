import { create } from "zustand";

/** True once persisted stores have loaded from localStorage on the client. */
export const useHydrated = create<{ ready: boolean }>(() => ({ ready: false }));
