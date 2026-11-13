import { AppShell } from "@/components/layout/app-shell"
import { placeholderCounts, placeholderUser } from "@/lib/placeholder-user"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell area="admin" user={placeholderUser} counts={placeholderCounts}>
      {children}
    </AppShell>
  )
}
