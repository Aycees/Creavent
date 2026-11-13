import { SignedInShell } from "@/components/layout/signed-in-shell"

export default function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  return <SignedInShell area="organizer">{children}</SignedInShell>
}
