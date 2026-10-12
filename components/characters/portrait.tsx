import type { CSSProperties } from "react";
import type { Character } from "@/lib/characters";

const sources = {
  rex: "/characters/rex.png",
  athena: "/characters/athena.png",
  jester: "/characters/jester.png",
  nubi: "/characters/nubi.png",
} as const;

export function Portrait({
  id,
  className,
}: {
  id: Character["id"] | "nubi";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`portrait-mask inline-block ${className ?? ""}`}
      style={{ "--portrait": `url(${sources[id]})` } as CSSProperties}
    />
  );
}
