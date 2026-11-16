-- The event changed and event canceled emails (spec §8.1, Phase 4).
ALTER TYPE "notification_type" ADD VALUE 'event_changed';
ALTER TYPE "notification_type" ADD VALUE 'event_canceled';
