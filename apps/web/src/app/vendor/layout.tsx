import { SignedInShell } from "@/components/layout/signed-in-shell"

export default function VendorLayout({ children }: LayoutProps<"/vendor">) {
  return <SignedInShell area="vendor">{children}</SignedInShell>
}
