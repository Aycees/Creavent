import { AppShell } from "@/components/layout/app-shell"
import { placeholderCounts, placeholderUser } from "@/lib/placeholder-user"

export default function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  return (
    <AppShell area="organizer" user={placeholderUser} counts={placeholderCounts}>
      {children}
    </AppShell>
  )
}
