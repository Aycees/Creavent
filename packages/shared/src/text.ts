// Control, zero-width, and direction-changing characters. They can make text
// read differently from what it is, so names and links may not contain them.
// Built from code points so no invisible character sits in this file.
const HIDDEN_RANGES: Array<[number, number]> = [
  [0x0000, 0x001f], // control characters
  [0x007f, 0x009f], // delete and C1 controls
  [0x200b, 0x200f], // zero-width spaces and joiners, left-to-right and right-to-left marks
  [0x2028, 0x202e], // line and paragraph separators, direction embeddings and overrides
  [0x2060, 0x2069], // word joiner, invisible operators, direction isolates
  [0xfeff, 0xfeff], // zero-width no-break space
];

const hex = (n: number) => '\\u' + n.toString(16).padStart(4, '0');

export const HIDDEN_CHARS = new RegExp(`[${HIDDEN_RANGES.map(([a, b]) => `${hex(a)}-${hex(b)}`).join('')}]`);
