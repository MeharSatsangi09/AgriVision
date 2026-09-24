"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from "motion/react";
import { cn } from "@/lib/utils";

// macOS-style dock: items grow toward the cursor (magnification), with a floating label per item.
// Same API as Motion Primitives' Dock (Dock / DockItem / DockLabel / DockIcon).
const DEFAULT_MAGNIFICATION = 80;
const DEFAULT_DISTANCE = 150;
const DEFAULT_PANEL_HEIGHT = 64;
const BASE_ITEM_SIZE = 40;

type DockContextType = { mouseX: MotionValue<number>; spring: SpringOptions; distance: number; magnification: number; baseSize: number };
const DockContext = createContext<DockContextType | null>(null);
const useDock = () => {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error("DockItem must be used inside <Dock>");
  return ctx;
};

type ItemContextType = { width: MotionValue<number>; isHovered: MotionValue<number> };
const ItemContext = createContext<ItemContextType | null>(null);
const useItem = () => {
  const ctx = useContext(ItemContext);
  if (!ctx) throw new Error("DockLabel/DockIcon must be used inside <DockItem>");
  return ctx;
};

export function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
  baseSize = BASE_ITEM_SIZE,
}: {
  children: ReactNode;
  className?: string;
  spring?: SpringOptions;
  magnification?: number;
  distance?: number;
  panelHeight?: number;
  baseSize?: number;
}) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  // The outer box only grows when magnified items would overflow the panel.
  const maxHeight = useMemo(() => Math.max(panelHeight, magnification), [magnification, panelHeight]);
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div style={{ height }} className="flex max-w-full items-center">
      <motion.div
        onMouseMove={({ clientX }) => {
          isHovered.set(1);
          mouseX.set(clientX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={cn("mx-auto flex w-fit items-center gap-3 rounded-2xl px-3", className)}
        style={{ height: panelHeight }}
        role="toolbar"
      >
        <DockContext.Provider value={{ mouseX, spring, distance, magnification, baseSize }}>{children}</DockContext.Provider>
      </motion.div>
    </motion.div>
  );
}

export function DockItem({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseX, spring, baseSize } = useDock();
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - rect.x - rect.width / 2;
  });
  const widthTransform = useTransform(mouseDistance, [-distance, 0, distance], [baseSize, magnification, baseSize]);
  const width = useSpring(widthTransform, spring);

  return (
    <ItemContext.Provider value={{ width, isHovered }}>
      <motion.div
        ref={ref}
        style={{ width }}
        onHoverStart={() => isHovered.set(1)}
        onHoverEnd={() => isHovered.set(0)}
        className={cn("relative inline-flex items-center justify-center", className)}
      >
        {children}
      </motion.div>
    </ItemContext.Provider>
  );
}

export function DockLabel({ children, className, side = "top" }: { children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  const { isHovered } = useItem();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = isHovered.on("change", (latest) => setVisible(latest === 1));
    return () => unsub();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: side === "top" ? -10 : 10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-fit whitespace-pre rounded-md border bg-card px-2 py-0.5 text-xs font-medium text-foreground shadow-sm",
            side === "top" ? "-top-6" : "top-full",
            className
          )}
          role="tooltip"
          style={{ x: "-50%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DockIcon({ children, className }: { children: ReactNode; className?: string }) {
  const { width } = useItem();
  const iconWidth = useTransform(width, (v) => v / 2);
  return (
    <motion.div style={{ width: iconWidth }} className={cn("flex aspect-square items-center justify-center", className)}>
      {children}
    </motion.div>
  );
}
