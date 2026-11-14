# CLAUDE.md

Project context and behavioral guidelines for Claude working on this codebase.

---

## Project

Creavent is a web platform that brings vendor-based community events together. Roles: organizers, vendors, attendees. The MVP focuses on flea markets. Status: Phase 1 (accounts and approval) merged. Phase 2 (events) is next, with the slot decisions of 2026-11-14 (preferred slots, sections, policy prefill) in the docs. Development goes one phase per branch and PR (`docs/development-plan.md`). See `README.md` for development and `docs/` for details.

---

## Writing Rules

- No em-dashes. Use commas, periods, colons, or parentheses instead.

---

## Development Approach

### Test-Driven Development

Write the test first. No production code without a failing test that demands it.

1. **Red**: write one failing test that describes the next behavior. Run it and confirm it fails for the right reason.
2. **Green**: write the minimum code to make it pass.
3. **Refactor**: clean up with the tests green. Run them again.

- Bug fixes start with a test that reproduces the bug.
- Test behavior through public interfaces (what a user or caller sees), not implementation details.
- Components: test what renders and how users interact (roles, labels, text), not internal state.
- Run the relevant tests before calling a task done. Report failures with their output, don't hide them.
- If a change genuinely can't be tested first (pure styling, config), say so and explain why.

### Mobile-First Design

Design and build for the smallest screen first, then enhance for larger ones.

- Write base styles for mobile (no breakpoint). Add `md:` styles (the only breakpoint, 760px) only to enhance for wider screens, never to undo mobile styles.
- Start layouts as a single column. Add columns and side-by-side arrangements as space allows.
- Touch targets at least 44x44px. Don't rely on hover for anything essential.
- Body text at least 16px on inputs to avoid iOS zoom. Keep content readable without horizontal scrolling.
- Verify every UI change at a narrow viewport (about 375px) before wider ones.
- Assume organizers, vendors, and attendees are mostly on phones, often on slow connections. Keep pages light.

---

## Behavioral Guidelines

### Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them, don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

Do not overcomplicate. Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it, don't delete it.

When your changes create orphans, remove imports/variables/functions that YOUR changes made unused. Don't touch pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals (see Test-Driven Development above):
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Build a screen" → "Write tests for its behavior, build it at mobile width first, then enhance for larger screens"

For multi-step tasks, state a brief plan before starting:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```
