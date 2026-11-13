// Empty page for a sitemap route that a later slice builds (docs/development-plan.md §3).
export function PlaceholderPage({ title, slice }: { title: string; slice: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h1">{title}</h1>
      <p className="text-muted">Built in slice {slice}.</p>
    </div>
  )
}
