"use client"

import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ShellUser } from "@/lib/placeholder-user"

// Account menu (sitemap §5): Account, a "Become a ..." entry for each missing role, Log out.
export function AccountMenu({ user }: { user: ShellUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-1 md:px-2" aria-label={`Account menu, ${user.name}`}>
          <Avatar>
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/account">Account</Link>
        </DropdownMenuItem>
        {!user.roles.includes("vendor") && (
          <DropdownMenuItem asChild>
            <Link href="/onboarding">Become a vendor</Link>
          </DropdownMenuItem>
        )}
        {!user.roles.includes("organizer") && (
          <DropdownMenuItem asChild>
            <Link href="/onboarding">Become an organizer</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {/* Signing out is wired up in slice 1.3. */}
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
