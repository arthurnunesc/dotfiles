---
name: diagnosing-bugs
description: Diagnose uncertain or hard bugs, intermittent faults, performance regressions, or an explicitly requested diagnosis.
---

# Diagnosing Bugs

Use this for uncertainty that needs evidence. For a clear cause, take the short path: inspect relevant evidence, reproduce or test when feasible, apply the minimal fix, and run a focused regression check.

## Preserve the signal

Record the user's exact symptom, expected behavior, scope, and environment. Read relevant code, logs, domain documents, and recent changes. Redact secrets from commands, output, traces, and artifacts; show only evidence needed for the diagnosis.

Choose the real integration seam: the boundary that can exercise the reported behavior, not a nearby internal symptom. Keep test services, data, and instrumentation isolated and owned.

## Build evidence

Seek the smallest safe reproduction or focused check. It should exercise the reported scenario and make the expected failure or measurement observable. For an intermittent fault, improve repeatability only as needed; for a performance regression, compare a relevant baseline with the regressed path or profile.

When a runnable reproduction is not yet possible, continue safe read-only evidence gathering. Form ranked, falsifiable hypotheses: state what each predicts and the evidence or probe that would distinguish it. Do not treat a hypothesis as a cause until the evidence supports it.

For incidents without local reproduction, disclose the uncertainty and continue from logs, traces, configuration, or code that is safe to inspect. Ask only for access, a redacted artifact, or an action that is genuinely blocked. Do not add production instrumentation, stress, or data changes without authorization.

## Fix and lock it down

Where feasible, add or adapt a regression test at the correct seam before the fix. Its expected result must express the user's symptom independently, and its failure must be for the intended reason. If no correct automated seam exists, document why and use the strongest focused evidence available.

Make the smallest change that explains the evidence. Re-run the regression test or reproduction, the original scenario, and focused checks for the affected blast radius. For a performance fix, remeasure the same scenario.

If you intentionally mutate code or a fixture to check regression sensitivity, first verify that the mutation landed and the check exercised it before trusting the expected failure. Restore only that owned mutation, including on interruption; never overwrite user changes. Mutation testing is optional; verifying and restoring any mutation you use is not.

## Finish cleanly

Remove owned temporary instrumentation and test resources, including debug logs, harnesses, containers, data, and files. Confirm cleanup. Report the symptom, evidence, cause or remaining hypothesis, changed behavior, checks, and uncertainty.
