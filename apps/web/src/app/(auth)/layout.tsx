import { Logo } from "@/components/ui/logo"

// Sign-in pages (mockup Signup, Login): the form on the left, a dark panel on
// the right on desktop only. No site header, so the form stays the focus.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh bg-surface">
      <div className="flex min-w-0 flex-1 flex-col px-4 py-4 md:px-10 md:py-7">
        <Logo />
        <main className="flex flex-1 justify-center py-8 md:items-center md:py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
      </div>
      <aside className="hidden flex-1 flex-col justify-between gap-10 bg-inverse p-10 text-on-inverse md:flex">
        <p className="text-cap text-on-inverse-muted">Davao City · free during launch</p>
        <h2 className="max-w-[460px] text-[40px] leading-[44px] font-bold tracking-[-0.03em] text-balance">
          Find your next stall in minutes, not group chats.
        </h2>
        <ul className="grid grid-cols-3 gap-4 border-t border-on-inverse-muted/30 pt-5">
          <li>
            <p className="text-label font-semibold">See fees first</p>
            <p className="text-cap text-on-inverse-muted">Prices and requirements before you apply</p>
          </li>
          <li>
            <p className="text-label font-semibold">Apply in a few taps</p>
            <p className="text-cap text-on-inverse-muted">Your shop profile is reused</p>
          </li>
          <li>
            <p className="text-label font-semibold">Track it all</p>
            <p className="text-cap text-on-inverse-muted">Slot, payment and deadlines</p>
          </li>
        </ul>
      </aside>
    </div>
  )
}
