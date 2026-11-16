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

// The Phase 4 emails to vendors (spec §8.1, decisions Q4, Q8).
describe('event changed and canceled emails', () => {
  it('shows the new and old time, and keeps the slot', async () => {
    const email = await renderEmail('event_changed', {
      ...base,
      eventName: 'Matina Night Flea',
      slotLabel: 'A-03',
      changes: [{ label: 'When', from: 'Sat, Nov 14 · 5 PM to 11 PM', to: 'Sat, Nov 14 · 4 PM to 11 PM' }],
    });

    expect(email.subject).toBe('Matina Night Flea: new date or time');
    expect(email.text).toContain('Your slot A-03 stays the same.');
    expect(email.text).toContain('Now: Sat, Nov 14 · 4 PM to 11 PM');
    expect(email.text).toContain('Was: Sat, Nov 14 · 5 PM to 11 PM');
  });

  it('names both changes in the subject', async () => {
    const email = await renderEmail('event_changed', {
      ...base,
      eventName: 'Matina Night Flea',
      slotLabel: null,
      changes: [
        { label: 'When', from: 'a', to: 'b' },
        { label: 'Where', from: 'c', to: 'd' },
      ],
    });

    expect(email.subject).toBe('Matina Night Flea: new date or time and place');
    expect(email.text).not.toContain('stays the same');
  });

  it('gives the reason and who to contact about a refund', async () => {
    const email = await renderEmail('event_canceled', {
      ...base,
      eventName: 'Pasalubong and Handmade Fair',
      schedule: 'Fri, Nov 20 to Sun, Nov 22 · 9 AM to 5 PM daily',
      place: 'Rizal Park, Davao City',
      slotLabel: 'C-07',
      reason: 'Typhoon signal 2 over Davao.',
      organizerName: 'Habi Events',
      organizerContact: '0918 555 0187',
    });

    expect(email.subject).toBe('Pasalubong and Handmade Fair is canceled');
    expect(email.text).toContain('Typhoon signal 2 over Davao.');
    expect(email.text).toContain('Contact Habi Events: 0918 555 0187.');
    expect(email.text).toContain('Your slot C-07');
  });
});
