"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// The link beside the logo on the sign-in pages, as in the mockup.
export function AuthTopLink() {
  const pathname = usePathname()
  const [text, href, label] =
    pathname === "/login" ? ["New here?", "/signup", "Create an account"] : ["Have an account?", "/login", "Log in"]
  return (
    <p className="text-sm text-muted">
      <span className="hidden md:inline">{text} </span>
      <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-ink">
        {label}
      </Link>
    </p>
  )
}
