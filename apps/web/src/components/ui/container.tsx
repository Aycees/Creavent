import * as React from "react"

import { cn } from "@/lib/utils"

// `.wrap`: public page content, up to 1264px with 16px (phone) or 32px gutters.
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-page px-4 md:px-8", className)} {...props} />
}

export { Container }
