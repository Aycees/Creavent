import { SignedInPage } from "@/components/layout/signed-in-shell"

// Pages for any signed-in user (sitemap §5).
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return <SignedInPage>{children}</SignedInPage>
}
