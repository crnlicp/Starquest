import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { id: number; text: string };
type Notify = (text: string) => void;

const ToastContext = createContext<Notify | null>(null);
const SHOW_MS = 4000;

// App-wide failure toast, shown when an optimistic change had to be put back.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback<Notify>((text) => {
    const id = nextId.current++;
    // Only the newest matters; older ones would stack over the page.
    setToasts([{ id, text }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), SHOW_MS);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="error-toasts" aria-live="assertive">
        <AnimatePresence>
          {toasts.map((x) => (
            <motion.p key={x.id} className="error-toast" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
              <span aria-hidden="true">😕 </span>
              {x.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast outside ToastProvider");
  return notify;
}
