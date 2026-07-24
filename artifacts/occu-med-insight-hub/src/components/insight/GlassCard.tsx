import { motion } from "framer-motion";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlassCardVariant = "flat" | "glass";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: GlassCardVariant;
  onClick?: MouseEventHandler<HTMLDivElement>;
};

const flatSurfaceStyle: CSSProperties = {
  border: 0,
  borderRadius: 0,
  background: "transparent",
  backgroundImage: "none",
  boxShadow: "none",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
};

export function GlassCard({
  children,
  className,
  delay = 0,
  variant = "flat",
  onClick,
}: GlassCardProps) {
  const isGlassCard = variant === "glass";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
      className={cn(isGlassCard ? "glass-card rounded-[28px]" : "relative", className)}
      style={isGlassCard ? undefined : flatSurfaceStyle}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
