import { renderEmail } from './render-email.js';

const base = { name: 'Rhea Montoya', url: 'http://localhost:3000/organizer/events/1/applications', supportEmail: 'support@creavent.example' };

// The Phase 3 emails (spec §8.1): subjects name the shop and event, and the
// body links to the page that needs action.
describe('core loop emails', () => {
  it('tells the organizer about a new application', async () => {
    const email = await renderEmail('application_submitted', { ...base, shopName: "Lola's Ukay", eventName: 'Lanang Holiday Flea' });

    expect(email.subject).toBe("New application: Lola's Ukay for Lanang Holiday Flea");
    expect(email.text).toContain('Hi Rhea,');
    expect(email.text).toContain(base.url);
  });

  it('tells the organizer about a withdrawal', async () => {
    const email = await renderEmail('application_withdrawn', { ...base, shopName: "Lola's Ukay", eventName: 'Lanang Holiday Flea' });

    expect(email.subject).toBe("Lola's Ukay withdrew their application to Lanang Holiday Flea");
  });
});
