# User Journeys

Core workflows that drive all UI decisions in reqcore. Each journey maps a persona through a
complete task, step by step.

## Personas

| Persona | Role | Primary goals |
|---------|------|--------------|
| **Hiring Manager** | Creates jobs, defines assessments, reviews candidates, makes hire/reject decisions | Own the pipeline end-to-end |
| **Recruiter** | Sources candidates, manages applications through stages, coordinates interviews | Day-to-day pipeline operations |
| **Org Admin** | Manages settings, pipeline config, team members, approval workflows | System administration |
| **Candidate** (external) | Applies to jobs, completes assessments, receives feedback | Token-scoped, no login |

---

## Journey 1: Post a Job

**Persona:** Hiring Manager

1. Open command palette (Cmd+K) and type "Create job", or navigate to Jobs page and click "+ New Job"
2. Fill job form: title, description, location, compensation range (min/max + currency)
3. Configure pipeline stages (use org default or customize per job)
4. Create assessment template: define rounds, tasks per round with weights, pass/fail criteria
5. Publish job: public apply link generated, job appears in pipeline view

**Key screens:** Jobs list, Job form, Pipeline settings, Assessment template builder

---

## Journey 2: Process a Candidate through Pipeline

**Persona:** Recruiter

1. New application arrives: notification bell shows badge, candidate card appears in "New" column on Kanban board
2. Click candidate card on the board: slide-in detail panel opens from right
3. Summary card at top shows: candidate name, stage, score, links, assessment status
4. Timeline below shows all activity (comments, documents, stage changes) with filter chips
5. Review application details, add comments, check documents
6. Advance stage: click "Advance to [Next Stage]" in summary card. Transition modal opens for confirmation (optional note, optional due date task)
7. If gate stage reached: assessment workflow triggers (see Journey 3)
8. If approval required for this transition: approval request sent, card shows "pending" badge
9. Continue through stages until final decision: hire or reject with undo protection (8s toast)

**Key screens:** Kanban board (full board view), slide-in detail panel (summary + timeline), transition modal

---

## Journey 3: Run an Assessment

**Persona:** Hiring Manager + Candidate

### Hiring Manager side
1. Candidate reaches assessment gate stage (shown as connector node on stage bar)
2. Click candidate card, then "View Assessment" link in summary card
3. Assessment workflow page opens (dedicated page, not inline form)
4. **Step 1: Send** - template auto-selected from job, set due date, click "Send to Candidate"
5. Email sent to candidate with token link. Assessment status: "Round 1 Sent"
6. Wait for candidate submission (notification when submitted)
7. **Step 2: Submitted** - view candidate's responses and uploaded files (read-only)
8. **Step 3: Evaluate** - score each task (0-10), add behavioral notes. Weighted total auto-computes
9. **Step 4: Decide** - hire / no-hire / borderline + trainability notes. Save decision
10. If multi-round: click "Advance to Round 2", repeat steps 4-9

### Candidate side
1. Receive email with assessment link (token-scoped, no login)
2. Open portal page: see job title, assessment brief, round info, due date
3. Complete responses per task, upload files via drag-and-drop
4. Submit assessment. Confirmation page shown. Status updates to "Submitted"
5. Receive feedback email when decision is made (structured: strengths, gaps, example)

**Key screens:** Assessment workflow page (4-step wizard), Candidate portal (public, token-scoped)

---

## Journey 4: Manage Pipeline and Team

**Persona:** Org Admin

1. Click avatar in top bar, select "Settings" from dropdown
2. **Pipeline configuration**: add/remove/reorder stages. Add gate stages (shown as checkpoints). Set approval rules (which transitions need approval)
3. **Team management**: invite members, assign roles (Admin, Manager, Recruiter). Role badges visible in team list
4. **Notification preferences**: per-type toggles (in-app, email) at org level. Users can override personally
5. **Integrations**: webhook config (secret key, payload schema docs, test button), email settings (Novu + Resend)

**Key screens:** Settings (avatar dropdown), Pipeline settings, Team settings, Integrations

---

## Journey 5: Review and Decide

**Persona:** Hiring Manager

1. Open dashboard (landing page after login): see action cards showing what needs attention
   - Pending approvals count
   - New applications today
   - Upcoming interviews this week
   - "Needs Your Attention" list (assessments awaiting review, approval requests, unread comments)
2. Click an action card to navigate directly to the relevant item
3. Notification bell in top bar: all notification types (approvals, comments, assessments, stage changes)
4. Candidate profile page: unified timeline across ALL applications for this candidate
5. Compare candidates within a pipeline stage on the Kanban board (all cards visible in the column)

**Key screens:** Action dashboard, Notification dropdown, Candidate profile page, Kanban board
