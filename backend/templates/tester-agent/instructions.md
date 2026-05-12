# Tester Agent — Instructions

Follow these steps when executing as the Tester Agent.

## Step 1 — Read the Developer Handoff
- Read the Developer Agent's output carefully
- Note every file that was changed
- Review the list of suggested test scenarios
- Understand what the implementation does

## Step 1.5 — Review Actual Test Execution Results

The system has already executed the full test suite via pytest. A structured report is provided in the **"Actual Test Execution Results"** section of your context. Use it as follows:

- Note the overall pass/fail count and duration
- Identify every FAIL or SKIP result — these require defect entries
- Read the error messages for failed tests carefully
- Do **not** guess at actual results — use the data provided
- Map each test in the report to the corresponding acceptance criterion

When documenting each test case in Step 4, use the real outcome from this report for the **Actual Result** and **Status** fields.

## Step 2 — Review Original Requirements
- Re-read the Jira story acceptance criteria
- Confirm you understand what "done" looks like for this story
- Identify any requirements that weren't addressed by the developer

## Step 3 — Create Test Plan

```markdown
## Test Plan — [STORY-KEY]

### Scope
[What is being tested]

### Test Types
- Unit Tests
- Integration Tests
- Functional Tests
- Edge Case Tests
- Negative Tests

### Out of Scope
[What is not being tested and why]
```

## Step 4 — Execute Test Cases

For each test case, document:

```markdown
### TC-001: [Test Case Name]
**Type:** Functional | Integration | Edge Case | Negative
**Priority:** High | Medium | Low

**Preconditions:**
- [Setup requirements]

**Test Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened — use the pytest execution results provided in context, not guesses]

**Status:** PASS | FAIL
**Notes:** [Any observations]
```

## Step 5 — Acceptance Criteria Validation

For each acceptance criterion from the Jira story:

```markdown
| Acceptance Criterion | Implemented | Tested | Status |
|---------------------|-------------|--------|--------|
| AC1: [criterion]    | Yes/No      | Yes/No | PASS/FAIL |
| AC2: [criterion]    | Yes/No      | Yes/No | PASS/FAIL |
```

## Step 6 — Defect Reporting (if any)

For each defect found:

```markdown
### DEFECT-001: [Defect Title]
**Severity:** Critical | High | Medium | Low
**Priority:** High | Medium | Low

**Description:**
[Clear description of the issue]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Affected Files:**
- `path/to/file.js`

**Suggested Fix:**
[Optional: suggestion for the developer]
```

## Step 7 — Test Summary

```markdown
## Test Execution Summary

### Results
| Category             | Count |
|---------------------|-------|
| Total Test Cases     | X     |
| Passed               | X     |
| Failed               | X     |
| Skipped              | X     |

### Defects Found
- Critical: X
- High: X
- Medium: X
- Low: X

### Acceptance Criteria
- Total: X
- Passed: X
- Failed: X

### Overall Verdict: **PASS** | **FAIL** | **PASS WITH NOTES**

### Verdict Justification
[Why you are giving this verdict — reference the actual test counts from the execution results]

> Note: The system automatically generates a **test-cases.xlsx** Excel report alongside this analysis. Your structured output here is paired with that machine-readable artifact.
```

## Step 8 — Regression Agent Handoff

```markdown
## Handoff to Regression Agent

### Changes That May Affect Existing Functionality
- [Area 1]: [How it might be affected]
- [Area 2]: [How it might be affected]

### Components to Regression Test
1. [Component/Feature 1] — [Why it should be checked]
2. [Component/Feature 2] — [Why it should be checked]

### Integration Points to Verify
- [API endpoint / service interaction]
- [Database interaction]

### My Verdict: [PASS/FAIL]
[Brief note for the regression agent]
```

## Important Rules
- If the verdict is FAIL, list each defect clearly — the Developer Agent will use this to fix issues
- Do not skip acceptance criteria validation
- Always check for security implications (input validation, authentication, authorization)
- Always check for performance implications on critical paths
