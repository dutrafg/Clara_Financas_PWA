# Engineering and release standards

## Code quality

- Keep new and refactored JavaScript readable: use two-space indentation, descriptive names, one logical operation per line, and small functions with clear responsibilities.
- Preserve the app's existing data model and backward compatibility unless a migration is explicitly designed and tested.
- Treat user supplied values as untrusted. Validate at input and import boundaries; escape text before HTML insertion; never use `eval` or execute remote code.
- Keep financial values as safe integer cents. Reject malformed, out-of-range, duplicate, and cross-linked records before persistence or import.
- Do not clear the encrypted vault, OPFS, IndexedDB, or unrelated origin data as a side effect of updates or cleanup.

## Required checks for every release

Before merging or pushing a release to `main`:

1. Review the complete diff and run `git diff --check`.
2. Run `npm test`, `npm run build`, and `npm run verify:paths`.
3. Run the Python/Playwright browser matrix, including offline, update recovery, migration/backup, invalid values, injection payloads, and miniapp regressions.
4. Run JavaScript syntax checks and Python test compilation for changed source/tests.
5. Confirm all required GitHub Actions checks pass on the exact commit to be released.
6. Only then merge or push to `main` and verify the resulting production deployment and version metadata.

If a required check cannot run locally, use the repository's CI on a review branch and wait for its result. Never treat an unrun browser or security suite as passed.
