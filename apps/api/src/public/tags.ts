// The cache tags of the public pages (decision Q1). The web app files each
// cached page under the tags its response lists; the API asks for a tag to be
// refreshed when something it covers changes. Ids, not slugs, since slugs can
// be edited.
export const tags = {
  listing: 'listing',
  event: (id: string) => `event:${id}`,
  organizer: (organizerProfileId: string) => `organizer:${organizerProfileId}`,
  vendor: (vendorProfileId: string) => `vendor:${vendorProfileId}`,

  // An event page shows its organizer (or a pop-up's host) and its vendors,
  // so it is refreshed when any of them changes.
  forEvent(e: { id: string; organizerProfileId: string | null; hostVendorProfileId?: string | null; assignments?: { vendorProfileId: string }[] }) {
    return [
      tags.event(e.id),
      ...(e.organizerProfileId ? [tags.organizer(e.organizerProfileId)] : []),
      ...(e.hostVendorProfileId ? [tags.vendor(e.hostVendorProfileId)] : []),
      ...(e.assignments ?? []).map((a) => tags.vendor(a.vendorProfileId)),
    ];
  },
};
