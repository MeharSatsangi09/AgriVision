"use client";

import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { motion, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

function getRadius(className: unknown) {
    if (typeof className !== "string") return undefined;
    if (className.includes("rounded-full")) return "9999px";
    const radius = className.match(/(?:^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl)(?:\s|$)/)?.[1];
    if (!radius || radius === "none") return radius === "none" ? "0" : undefined;
    return {
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
    }[radius];
}

interface AnimatedBackgroundProps {
    children: ReactNode;
    defaultValue?: string;
    className?: string;
    transition?: Transition;
    enableHover?: boolean;
}

export function AnimatedBackground({
    children,
    defaultValue,
    className,
    transition = { type: "spring", bounce: 0.2, duration: 0.3 },
    enableHover = false,
}: AnimatedBackgroundProps) {
    const [activeValue, setActiveValue] = useState(defaultValue ?? null);
    const [hoverValue, setHoverValue] = useState<string | null>(null);
    const value = enableHover && hoverValue ? hoverValue : activeValue;

    return (
        <div className={cn("relative", className)} onMouseLeave={enableHover ? () => setHoverValue(null) : undefined}>
            {Children.map(children, (child) => {
                if (!isValidElement(child)) return child;
                const dataId = child.props["data-id"] as string | undefined;
                if (!dataId) return child;
                const isActive = value === dataId;
                const radius = getRadius(child.props.className);
                const props = {
                    onMouseEnter: (event: React.MouseEvent) => {
                        setHoverValue(enableHover ? dataId : null);
                        child.props.onMouseEnter?.(event);
                    },
                };
                return (
                    <div key={dataId} className="relative" style={{ borderRadius: radius }}>
                        {isActive && (
                            <motion.div
                                layoutId={`animated-background-${radius ?? "default"}`}
                                initial={false}
                                className="pointer-events-none absolute inset-0 z-0 bg-transparent shadow-[0_0_18px_3px_rgba(47,107,58,0.22)]"
                                style={{ borderRadius: radius }}
                                transition={transition}
                            />
                        )}
                        {cloneElement(child as ReactElement<{ onMouseEnter?: (event: React.MouseEvent) => void }>, props)}
                    </div>
                );
            })}
        </div>
    );
}