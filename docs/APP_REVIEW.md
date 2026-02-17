# App Review — Logical Consistency & UX

## Summary

Overall the app is **well-structured** and follows a clear flow. A few improvements will make it more consistent and easier to follow.

---

## Role-by-Role Analysis

### Rep (AE — being certified)

| Aspect | Status | Notes |
|--------|--------|-------|
| Discovery | ✓ | No action until manager shares; then DM + Home |
| MY RESULTS on Home | ✓ | Shows pass/fail after share |
| Clarity | ⚠ | "Week 2 — PASS" is minimal; could clarify |
| Empty state | ⚠ | "No pending reviews" is misleading when waiting for results |

### Manager

| Aspect | Status | Notes |
|--------|--------|-------|
| Launch flow | ✓ | /certify → DM with Submit (if reviewer) |
| MY CERTIFICATIONS | ✓ | Progress, View details, Share with rep |
| Self-cert (manager = AE) | ✓ | Submit appears in MY CERTIFICATIONS |
| Redundancy | ⚠ | Same cert can appear in PENDING and MY CERTIFICATIONS |
| Empty state | ⚠ | No guidance when they have no certs |

### Reviewer

| Aspect | Status | Notes |
|--------|--------|-------|
| DM notification | ✓ | Submit button right in the message |
| Home tab | ✓ | PENDING and SUBMITTED with clear actions |
| Edit flow | ✓ | From DM or Home after submit |

---

## Issues Found

### 1. Duplicate cert display (manager who is also reviewer)

When you're the manager and a reviewer, the same cert appears in:
- **PENDING** (or SUBMITTED) with Submit/Edit
- **MY CERTIFICATIONS** with Submit / View details / Share

**Fix:** Show manager's own certs only in MY CERTIFICATIONS. Remove from PENDING/SUBMITTED. The Submit/Edit actions are available in MY CERTIFICATIONS.

### 2. Misleading empty state

"No pending reviews. You're all caught up!" is wrong when:
- **AE** waiting for manager to share results
- **Manager** with no certifications yet

**Fix:** Role-aware empty states.

### 3. Sparse MY RESULTS for AE

"Week 2 — PASS" gives little context.

**Fix:** Use clearer text, e.g. "Your Week 2 certification — PASS".

### 4. Footer applies to everyone

"Managers: use /certify to launch a certification" shows for reps and reviewers who can't launch.

**Fix:** Soften or make conditional.

### 5. Optional notes never shown

Manager's context/notes are stored but not shown to reviewers or in results. Minor; may be intentional.

---

## Flow Verification

| Flow | Correct? |
|------|----------|
| Manager launches → reviewers + manager get DM with Submit | ✓ |
| Reviewer submits → DM updates, Home refreshes | ✓ |
| Manager shares → AE gets DM, MY RESULTS appears | ✓ |
| Self-cert (manager = AE = reviewer) | ✓ (after recent fix) |
| Edit after submit | ✓ (DM + Home) |

---

## Fixes Applied

1. ✓ **Deduped manager's certs** — Manager's own certs now appear only in MY CERTIFICATIONS (removed from PENDING/SUBMITTED).
2. ✓ **AE "In progress" section** — AEs see certs waiting for manager to share, with review count (e.g. 2/3 submitted).
3. ✓ **Clearer MY RESULTS** — Text changed to "\*Week 2 certification\* — PASS".
4. ✓ **Softer footer** — "To launch a certification: `/certify`" (applies to everyone).
5. ✓ **Empty state** — "Nothing here yet. Use `/certify` to launch a certification, or check back for results."
