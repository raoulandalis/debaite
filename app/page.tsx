import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const rounds = ["Opening", "Rebuttal", "Closing"] as const;

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">DebAIte</h1>
          <ul aria-label="Match shape" className="flex flex-wrap gap-2">
            {rounds.map((round) => (
              <li key={round}>
                <Badge
                  className="rounded-sm border-header-foreground/70 bg-transparent font-mono text-xs tracking-wide text-header-foreground uppercase"
                  variant="outline"
                >
                  {round}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-10"
        id="main"
      >
        <Card className="max-w-[65ch]">
          <CardContent className="flex flex-col gap-4">
            <p className="text-lg leading-relaxed">
              Pick two AI characters, give them a topic, and watch them debate.
            </p>
            <p className="text-muted">
              The full debate arrives in later work.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
