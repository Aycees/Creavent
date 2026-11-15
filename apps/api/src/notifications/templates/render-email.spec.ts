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

// A vendor's slots are named together (decision P6).
describe('emails about several slots', () => {
  const assigned = { ...base, eventName: 'Lanang Holiday Flea', amount: '₱2,300', deadlineAt: '2026-12-01T08:00:00Z', instructions: ['GCash: 0917 482 1093'] };

  it('says "slots" for more than one', async () => {
    const email = await renderEmail('slot_assigned', { ...assigned, slotLabel: 'A-01, B-01' });

    expect(email.subject).toBe('Slots A-01, B-01 at Lanang Holiday Flea: pay to confirm');
    expect(email.text).toContain('assigned you slots A-01, B-01');
  });

  it('keeps "slot" for one', async () => {
    const email = await renderEmail('slot_assigned', { ...assigned, slotLabel: 'A-01' });

    expect(email.subject).toBe('Slot A-01 at Lanang Holiday Flea: pay to confirm');
  });

  it('tells the organizer that every slot opened again', async () => {
    const email = await renderEmail('slot_released', { ...base, shopName: "Lola's Ukay", eventName: 'Lanang Holiday Flea', slotLabel: 'A-01, A-02', newPreference: 'B-01' });

    expect(email.subject).toBe("Lola's Ukay released slots A-01, A-02");
    expect(email.text).toContain('The slots are open again');
    expect(email.text).toContain("They'd like slot B-01 instead.");
  });
});
