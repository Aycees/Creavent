import { SessionPublicHeader } from "@/components/layout/session-public-header"
import { SiteFooter } from "@/components/layout/site-footer"

// Public pages (sitemap §5).
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col max-md:has-[[data-sticky-bar]]:pb-24">
      <SessionPublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
