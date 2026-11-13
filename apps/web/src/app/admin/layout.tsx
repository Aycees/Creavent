import { SignedInShell } from "@/components/layout/signed-in-shell"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <SignedInShell area="admin">{children}</SignedInShell>
}
