"use client"

import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import type { ShellUser } from "@/lib/shell-user"

// Account menu (sitemap §5): a dashboard link for each role (and Admin for
// admins), Account, a "Become a ..." entry for each missing role, Log out.
export function AccountMenu({ user }: { user: ShellUser }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  async function logOut() {
    await authClient.signOut()
    queryClient.clear()
    router.replace("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-1 md:px-2" aria-label={`Account menu, ${user.name}`}>
          <Avatar>
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user.roles.includes("vendor") && (
          <DropdownMenuItem asChild>
            <Link href="/vendor">Vendor dashboard</Link>
          </DropdownMenuItem>
        )}
        {user.roles.includes("organizer") && (
          <DropdownMenuItem asChild>
            <Link href="/organizer">Organizer dashboard</Link>
          </DropdownMenuItem>
        )}
        {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">Admin</Link>
          </DropdownMenuItem>
        )}
        {(user.roles.length > 0 || user.isAdmin) && <DropdownMenuSeparator />}
        <DropdownMenuItem asChild>
          <Link href="/account">Account</Link>
        </DropdownMenuItem>
        {!user.roles.includes("vendor") && (
          <DropdownMenuItem asChild>
            <Link href="/onboarding?role=vendor">Become a vendor</Link>
          </DropdownMenuItem>
        )}
        {!user.roles.includes("organizer") && (
          <DropdownMenuItem asChild>
            <Link href="/onboarding?role=organizer">Become an organizer</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
