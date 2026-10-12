import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-16 w-full rounded-sm border border-border bg-surface-raised px-2.5 py-2 text-base text-foreground transition-colors placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-for disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-raised disabled:text-muted disabled:opacity-100 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
