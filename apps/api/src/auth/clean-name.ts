import { HIDDEN_CHARS } from '@creavent/shared';

const HIDDEN_GLOBAL = new RegExp(HIDDEN_CHARS.source, 'g');

// A name from outside our forms (a Google profile) is cleaned instead of
// refused: hidden characters removed, spaces collapsed, at most 100 characters.
export function cleanName(name: string) {
  return name.replace(HIDDEN_GLOBAL, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}
