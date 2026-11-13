import { PublicHeader } from "@/components/layout/public-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { placeholderUser } from "@/lib/placeholder-user"

// Pages for any signed-in user: the public header with the account menu (sitemap §5).
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader user={placeholderUser} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
