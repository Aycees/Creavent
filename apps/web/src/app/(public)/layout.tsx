import { PublicHeader } from "@/components/layout/public-header"
import { SiteFooter } from "@/components/layout/site-footer"

// Public pages, signed out (sitemap §5).
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
