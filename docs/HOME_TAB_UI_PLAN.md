# Home Tab UI Overhaul — Implementation Plan

## Goal
Make the **Home tab the single, clear source of truth** for certification workflows. Reduce reliance on the History/Messages tab and simplify the UX for reviewers, managers, and AEs.

---

## Why Notifications Go to History (and the constraint)
Slack shows the red badge on the **Messages** tab when the app has sent you a DM. We cannot move that badge to the Home tab—that's a Slack platform constraint. 

**Mitigation:** We’ll make Home the *primary* place for actions. DMs become lightweight “hey, check the app” nudges instead of full interaction surfaces. When users open the app (triggered by the badge), they’ll land on Messages, see a short “Open Home tab to submit/check status,” and switch to Home for real work.

---

## New Home Tab Structure

Home will show **role-based sections** (only sections with content). Each user sees what’s relevant.

### For Reviewers

| Section        | Content                                                                 | Actions                                   |
|----------------|-------------------------------------------------------------------------|-------------------------------------------|
| **Pending**    | Certs I need to submit (AE name, week)                                  | *Submit review* button                    |
| **Submitted**  | Certs I’ve already reviewed                                             | *Edit review* button                      |

### For Managers

| Section        | Content                                                                 | Actions                                   |
|----------------|-------------------------------------------------------------------------|-------------------------------------------|
| **My certifications** | Certs I launched (AE name, week, progress)                      | Progress + *View details* / *Share with rep* |

- Each row: **AE Name — Week** + progress (e.g. `2/3 submitted`).
- Clicking a row (or “View details”) opens a **modal**:
  - List reviewers and their status (✓ Submitted / ○ Pending).
  - When all submitted: **Share score with rep** button.
  - Optional: **Copy results** for pasting elsewhere.

### For AEs (being certified)

| Section        | Content                                                                 | Actions                                   |
|----------------|-------------------------------------------------------------------------|-------------------------------------------|
| **My results** | Certs where I’m the AE, with pass/fail once shared                     | None (read-only)                          |

- Only shows when the manager has shared results.
- AE also gets a DM when shared (for immediate notification); Home is the persistent record.

---

## Flow Changes

### 1. Cert launch (`/certify`)
- Create session (unchanged).
- **Update Home for everyone:**
  - `views.publish` to each **reviewer** (add pending item).
  - `views.publish` to **manager** (add to “My certifications”).
- **Simplify DMs:**
  - Reviewer DM: *“You have a new certification review. Open the app and go to the **Home** tab to submit.”* (no “Submit review” button—everything happens in Home).
  - Manager DM: *“Certification launched for [AE]. Open the **Home** tab to track progress.”*

### 2. Reviewer submits
- Save review (unchanged).
- **Update Home:**
  - `views.publish` to that reviewer (move from Pending → Submitted).
  - `views.publish` to manager (increment progress, e.g. 2/3).
- Remove or simplify DM update (no need for “Edit review” in DM if it’s in Home).

### 3. Manager shares with rep
- New action: **Share score with rep** (from Home modal or Home row when all in).
- DM AE with results (unchanged).
- Mark session as `shared_with_ae: true`.
- **Update Home:**
  - Manager: remove from “My certifications” or mark as “Shared ✓”.
  - AE: add to “My results” section.

---

## Data Layer Additions

| Function                            | Purpose                                              |
|-------------------------------------|------------------------------------------------------|
| `getSessionsForManager(managerId)`  | All sessions where I’m the manager                   |
| `getSubmittedSessionsForReviewer(userId)` | Sessions I’ve submitted (for Edit button)   |
| `getSessionsForAE(aeId)`           | Sessions where I’m the AE, with `shared_with_ae`      |

**Schema change:** Add `shared_with_ae: boolean` (and optionally `shared_at`) to sessions. Default `false` until manager shares.

---

## Implementation Order

### Phase 1 — DB and Home foundation
1. Add `shared_with_ae` (and optionally `shared_at`) to session schema.
2. Implement `getSessionsForManager`, `getSubmittedSessionsForReviewer`, `getSessionsForAE`.
3. Refactor Home `app_home_opened` to build blocks from these three data sources.
4. Show Reviewer (Pending + Submitted) and Manager sections with correct data.

### Phase 2 — Manager modal and “Share”
5. Add “View details” / row click that opens a modal with reviewer status.
6. Add “Share score with rep” button (enabled when all reviewers submitted).
7. Handler: DM AE, set `shared_with_ae`, republish Home for manager and AE.

### Phase 3 — Proactive Home updates
8. After cert launch: `views.publish` to each reviewer and manager.
9. After reviewer submits: `views.publish` to reviewer and manager.
10. After manager shares: `views.publish` to manager and AE.

### Phase 4 — Simplify DMs
11. Change reviewer DM to text-only “check Home” style message (no Submit button).
12. Change manager DM to text-only “check Home” style message.
13. Optionally remove DM “Edit review” update—Edit only lives in Home.

### Phase 5 — Polish
14. Add AE “My results” section on Home.
15. Consider removing History-reliant flows if possible.
16. Update `SETUP_GUIDE.md` with new UX.

---

## UI Sketch (Home tab)

```
┌─────────────────────────────────────────────────────────────┐
│  Certification Review                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PENDING (2)                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ John Doe — Week 2           [ Submit review ]        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Jane Smith — Week 3         [ Submit review ]        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  SUBMITTED (1)                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Mike Chen — Week 1          [ Edit review ]          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  (Manager section — only if manager)                         │
│  MY CERTIFICATIONS (1)                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Sarah Lee — Week 2    2/3 submitted  [ View details ] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Managers: use /certify to launch a certification.           │
└─────────────────────────────────────────────────────────────┘
```

---

## Notes
- Keep the structure minimal: at most 3–4 sections per role.
- Only show sections that have items.
- Use clear labels (PENDING, SUBMITTED, MY CERTIFICATIONS, MY RESULTS).
- Avoid cluttering History; keep DMs short and actionable.
