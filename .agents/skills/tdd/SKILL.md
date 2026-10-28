---
name: tdd
description: Test-driven development for an explicitly test-first or red-green-refactor request.
---

# Test-Driven Development

Use TDD when the user explicitly asks for test-first work or a red-green-refactor loop. It does not apply to every request for integration tests.

## Establish the boundary

Read relevant existing `GLOSSARY.md`, `CONTEXT.md`, and ADRs when they describe the affected domain. Do not create, rename, or globalize those documents for this work.

Use documented or established public test boundaries without repeated confirmation. For each proposed boundary, add a short **catches / misses** note: the behavior it protects and the meaningful behavior it leaves to another boundary. Ask the user only when behavior or a new public interface is materially unresolved.

Tests observe behavior through public interfaces and use independent expected results from a specification, known-good example, or worked outcome. Avoid implementation-coupled and tautological tests. Preserve project test isolation and safety rules.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidance.

## Run one vertical slice

1. Pick one behavior at an established boundary and write its test.
2. Run it and confirm it fails for the intended reason.
3. Make only enough production change to pass it.
4. Run the focused test again.
5. Refactor behavior-preservingly when it improves the code, then run appropriate focused checks.

Repeat one vertical slice at a time. Do not write a broad layer of imagined tests before learning from the first red-green cycle.

## Finish

Run focused checks that cover the changed behavior and report each boundary's catches / misses, red result, green result, refactoring checks, and any unresolved behavior.
