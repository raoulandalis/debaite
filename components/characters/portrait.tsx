import type { CSSProperties } from "react";

const sources = {
  rex: "/characters/rex.png",
  athena: "/characters/athena.png",
  jester: "/characters/jester.png",
  nubi: "/characters/nubi.png",
  "victory-rex": "/characters/victory-rex.png",
  "victory-athena": "/characters/victory-athena.png",
  "victory-jester": "/characters/victory-jester.png",
  "victory-tie": "/characters/victory-tie.png",
} as const;

export function Portrait({
  id,
  className,
}: {
  id: keyof typeof sources;
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
