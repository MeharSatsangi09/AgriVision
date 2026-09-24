"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, type SpringOptions } from "motion/react";

export type TiltProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  rotationFactor?: number;
  isRevese?: boolean;
  springOptions?: SpringOptions;
};

const DEFAULT_SPRING: SpringOptions = { stiffness: 300, damping: 30, mass: 0.5 };

// Basic 3D tilt-on-hover: tracks cursor position within the element and maps it to rotateX/rotateY,
// spring-smoothed and reset on mouse leave. Same shape/props as Motion Primitives' Tilt component.
export function Tilt({ children, className, style, rotationFactor = 15, isRevese = false, springOptions }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const xSpring = useSpring(x, springOptions ?? DEFAULT_SPRING);
  const ySpring = useSpring(y, springOptions ?? DEFAULT_SPRING);

  const factor = isRevese ? -rotationFactor : rotationFactor;
  const rotateX = useTransform(ySpring, [0, 1], [factor, -factor]);
  const rotateY = useTransform(xSpring, [0, 1], [-factor, factor]);

  const [hovered, setHovered] = useState(false);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((event.clientX - rect.left) / rect.width);
    y.set((event.clientY - rect.top) / rect.height);
  }

  function handleMouseLeave() {
    setHovered(false);
    x.set(0.5);
    y.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, perspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        animate={{ scale: hovered ? 1.015 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
