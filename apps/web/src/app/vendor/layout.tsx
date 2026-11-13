import { AppShell } from "@/components/layout/app-shell"
import { placeholderCounts, placeholderUser } from "@/lib/placeholder-user"

export default function VendorLayout({ children }: LayoutProps<"/vendor">) {
  return (
    <AppShell area="vendor" user={placeholderUser} counts={placeholderCounts}>
      {children}
    </AppShell>
  )
}
