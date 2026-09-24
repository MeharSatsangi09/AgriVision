"use client";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, type TargetAndTransition, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

// Motion Primitives-style MorphingPopover: the trigger and the panel share a layoutId, so the trigger
// visibly morphs into the panel. Same API (MorphingPopover / Trigger / Content) as the library.
const TRANSITION: Transition = { type: "spring", bounce: 0.05, duration: 0.3 };

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  uniqueId: string;
  variants?: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition };
};
const PopoverContext = createContext<Ctx | null>(null);
const usePopover = () => {
  const c = useContext(PopoverContext);
  if (!c) throw new Error("Morphing popover parts must be used inside <MorphingPopover>");
  return c;
};

export function MorphingPopover({
  children,
  transition = TRANSITION,
  variants,
  className,
  open: controlled,
  onOpenChange,
}: {
  children: ReactNode;
  transition?: Transition;
  variants?: Ctx["variants"];
  className?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const uniqueId = useId();
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, uniqueId, variants }), [open, uniqueId, variants]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MotionConfig transition={transition}>
      <PopoverContext.Provider value={value}>
        <div ref={root} className={cn("relative", open && "z-30", className)}>
          {children}
        </div>
      </PopoverContext.Provider>
    </MotionConfig>
  );
}

export function MorphingPopoverTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const { open, setOpen, uniqueId } = usePopover();
  return (
    <motion.button
      type="button"
      key={uniqueId}
      layoutId={`popover-trigger-${uniqueId}`}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      style={{ borderRadius: 16 }}
      className={cn("block w-full text-left", className)}
    >
      {children}
    </motion.button>
  );
}

export function MorphingPopoverContent({ children, className }: { children: ReactNode; className?: string }) {
  const { open, setOpen, uniqueId, variants } = usePopover();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          layoutId={`popover-trigger-${uniqueId}`}
          key={`content-${uniqueId}`}
          role="dialog"
          onClick={(e) => !(e.target as HTMLElement).closest("a") && setOpen(false)}
          style={{ borderRadius: 16 }}
          initial={variants?.initial}
          animate={variants?.animate}
          exit={variants?.exit}
          className={cn("absolute left-0 top-0 z-50 cursor-pointer overflow-hidden border bg-card text-card-foreground shadow-lg", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
