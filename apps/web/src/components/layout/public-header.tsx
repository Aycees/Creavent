import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import type { ShellUser } from "@/lib/shell-user"
import { AccountMenu } from "./account-menu"
import { NavLink } from "./nav-link"

// `.hdr`: 64px public header. Signed out it has Log in and Sign up; signed in, the account menu.
export function PublicHeader({ user }: { user?: ShellUser }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-6 px-4 md:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <NavLink
            href="/"
            exact
            className="inline-flex h-11 items-center rounded-md px-3 text-label text-muted no-underline hover:text-ink data-active:text-ink"
          >
            Events
          </NavLink>
        </nav>
        <div className="flex flex-1 items-center justify-end gap-2">
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <>
              <Button asChild variant="ghost" className="px-3 md:px-5">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="px-4 md:px-5">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
