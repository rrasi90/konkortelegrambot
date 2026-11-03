# A-19 Replayable Migrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `supabase/tests/run.sh` apply the schema twice without error, so migrations 0001/0005/0006/0007 are re-runnable and CI proves it.

**Architecture:** Two changes only. (۱) The harness gains a second application pass plus two invariant checks (policies unchanged, seed row counts unchanged). (۲) The 14 bare `create policy` statements in four migration files get a preceding `drop policy if exists`, matching the pattern already used by 0011/0012/0015. No table, no column, no data changes.

**Tech Stack:** PostgreSQL 16 (docker container `ael-pg-test`, and `postgres:16-alpine` in CI), plain SQL migrations, bash harness.

**Spec:** `docs/superpowers/specs/2026-11-03-open-register-items-design.md` (item ۱) · register row `A-19` in `docs/audit/REMEDIATION_REGISTER.md`

## Global Constraints

- No destructive statement: this plan adds `drop policy if exists` only — never `drop table`, `truncate`, or `delete`.
- Migration files are ordered `0001…0015`; a new file number is **not** created for this fix (the four files have never been applied to a real database, since production has no Supabase connection — see runbook §۲-پ).
- Policy names and `using` expressions must stay byte-identical; only a guard line is added above each.
- The existing 16-block integrity suite must keep passing, and must be run **after** the second application pass.
- Every claim of "fixed" needs captured command output in `evidence/audit-20261103/` (the mission forbids asserting without a run).
- Local harness invocation used throughout: there is **no host `psql`** (verified) and the
  container publishes host port **۵۴۳۳** (container port ۵۴۳۲). The harness runs *inside* the
  container, where `bash` and `psql` both exist:

```bash
docker cp supabase ael-pg-test:/tmp/ael-supabase
docker exec -e DATABASE_URL=postgres://ael:ael@localhost:5432/<db> ael-pg-test bash /tmp/ael-supabase/tests/run.sh
docker exec ael-pg-test rm -rf /tmp/ael-supabase   # cleanup
```

  Re-copy `/tmp/ael-supabase` after each edit to `supabase/` so the container sees the new files.
  For ad-hoc single-file applies use
  `docker exec -i ael-pg-test psql -U ael -d <db> -v ON_ERROR_STOP=1 -f - < <file>` with
  `MSYS_NO_PATHCONV=1` exported (Git Bash rewrites `/`-prefixed args otherwise).

## Review Focus

Failure modes the spec implies but a naive fix would miss:

1. **Silent policy rewrite.** `drop` + `create` on a database where the policy already exists could change its definition unnoticed. Pinned check: policy rows (name, cmd, qual) are identical before and after the second pass.
2. **Seed duplication.** A second seed pass must not add rows. Pinned check: row counts of `knowledge_nodes`, `questions`, `skills`, `exam_packs` identical after pass ۱ and pass ۲.
3. **Guard added but wrong object.** A `drop policy if exists X on wrong_table` is a no-op that "passes" while the real error stays. Pinned check: the harness must fail if any single migration file errors, per file, with the filename printed.
4. **Only the first offender fixed.** `ON_ERROR_STOP` aborts a file at its first error, so files ۰۰۰۱/۰۰۰۵/۰۰۰۶ hide further bare statements. Pinned check: the count of `^create policy` without an immediately preceding `drop policy if exists` is zero in all four files.
5. **Replay passes but real behavior regressed.** Pinned check: full 16-block integrity suite exits ۰ on the twice-applied database.

---

### Task 1: Replay check in the database harness (red)

**Files:**
- Modify: `supabase/tests/run.sh`
- Test: the harness itself is the test; its output is the evidence

**Interfaces:**
- Consumes: existing env contract `DATABASE_URL` (CI sets `postgres://ael:ael@localhost:5432/ael_test`).
- Produces: `run.sh` that applies migrations and seeds **twice**, asserts policies and seed counts are unchanged, then runs `supabase/tests/integrity.test.sql`. Exit ۰ = pass; any error = non-zero exit with the failing filename printed.

- [ ] **Step 1: Write the failing check into the harness**

Replace the single-application loop in `supabase/tests/run.sh` with two passes plus the two invariant checks. Keep the existing file lists and ordering. The added pieces:

```bash
counts() {
  psql "$DATABASE_URL" -tAc \
    "select (select count(*) from knowledge_nodes)||'/'||(select count(*) from questions)||'/'||(select count(*) from skills)||'/'||(select count(*) from exam_packs)"
}
policies() {
  psql "$DATABASE_URL" -tAc \
    "select tablename||'.'||policyname||'.'||cmd||'.'||coalesce(qual,'') from pg_policies where schemaname='public' order by 1"
}
```

- Pass ۱: apply migrations then seeds (as today).
- Capture `POLICIES_1=$(policies)` and `COUNTS_1=$(counts)`.
- Pass ۲: apply migrations then seeds again, each file piped through
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -`, and on non-zero exit print
  `REPLAY_FAILED <file>` and `exit 1`.
- Assert `[ "$POLICIES_1" = "$POLICIES_2" ]` else print `POLICY_DRIFT` and exit ۱;
  same for counts with `SEED_ROW_COUNT_CHANGED`.
- Then run the integrity suite exactly as today.

- [ ] **Step 2: Run the harness and verify it fails on the real errors**

```bash
docker exec ael-pg-test psql -U ael -d postgres -c 'drop database if exists ael_a19' -c 'create database ael_a19 owner ael'
docker cp supabase ael-pg-test:/tmp/ael-supabase
docker exec -e DATABASE_URL=postgres://ael:ael@localhost:5432/ael_a19 ael-pg-test \
  bash /tmp/ael-supabase/tests/run.sh > evidence/audit-20261103/a19-replay-red.txt 2>&1; echo EXIT=$?
```

Expected: `EXIT=1` and the output containing `REPLAY_FAILED supabase/migrations/0001_init.sql` with
`policy "read_nodes" for table "knowledge_nodes" already exists`. This is the red state — four files are known to fail (۰۰۰۱, ۰۰۰۵, ۰۰۰۶, ۰۰۰۷; ۱۴ bare `create policy` statements, zero guards).

- [ ] **Step 3: Commit the failing harness**

```bash
git add supabase/tests/run.sh evidence/audit-20261103/a19-replay-red.txt
git commit -m "test(db): assert migrations and seeds are replayable (currently fails on 4 files)"
```

---

### Task 2: Guard the 14 bare policy statements (green)

**Files:**
- Modify: `supabase/migrations/0001_init.sql:165-173` (۸ statements)
- Modify: `supabase/migrations/0005_attempt_tracking.sql:89-91` (۳)
- Modify: `supabase/migrations/0006_learner_and_security.sql:262-263` (۲)
- Modify: `supabase/migrations/0007_tracks_and_assets.sql:26` (۱)
- Test: `supabase/tests/run.sh` from Task ۱

**Interfaces:**
- Consumes: the replay harness and its three failure markers (`REPLAY_FAILED`, `POLICY_DRIFT`, `SEED_ROW_COUNT_CHANGED`).
- Produces: `0001…0015` applyable in order any number of times with identical resulting policies and seed rows.

- [ ] **Step 1: Add the guard line above each bare `create policy`**

For every one of the ۱۴ statements, insert immediately above it a line following the pattern already used in ۰۰۱۱/۰۰۱۲/۰۰۱۵ — same policy name, same table:

```sql
drop policy if exists read_nodes on knowledge_nodes;
create policy read_nodes on knowledge_nodes for select using (true);
```

Do not touch the `using` expressions, do not reorder statements, do not renumber files.

- [ ] **Step 2: Verify no bare statements remain (Review Focus ۴)**

```bash
for f in 0001_init 0005_attempt_tracking 0006_learner_and_security 0007_tracks_and_assets; do
  awk '/^create policy/{if(prev!~/^drop policy if exists/)c++} {prev=$0} END{print FILENAME": unguarded="c+0}' supabase/migrations/$f.sql
done
```
Expected: `unguarded=0` on all four lines.

- [ ] **Step 3: Run the harness and verify green**

```bash
docker exec ael-pg-test psql -U ael -d postgres -c 'drop database if exists ael_a19' -c 'create database ael_a19 owner ael'
docker cp supabase ael-pg-test:/tmp/ael-supabase
docker exec -e DATABASE_URL=postgres://ael:ael@localhost:5432/ael_a19 ael-pg-test \
  bash /tmp/ael-supabase/tests/run.sh > evidence/audit-20261103/a19-replay-green.txt 2>&1; echo EXIT=$?
```
Expected: `EXIT=0`, no `REPLAY_FAILED` / `POLICY_DRIFT` / `SEED_ROW_COUNT_CHANGED` in the file, and the integrity suite line output ending with the ۱۶ `DO` rows (Review Focus ۱, ۲, ۵).

- [ ] **Step 4: Prove the JS test suite is unaffected**

```bash
npm test 2>&1 | tail -n 5
```
Expected: `Tests  337 passed (337)`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql supabase/migrations/0005_attempt_tracking.sql \
        supabase/migrations/0006_learner_and_security.sql supabase/migrations/0007_tracks_and_assets.sql \
        evidence/audit-20261103/a19-replay-green.txt
git commit -m "fix(db): make policy creation idempotent so 0001/0005/0006/0007 can be re-applied"
```

---

### Task 3: Close A-19 in the audit record

**Files:**
- Modify: `docs/audit/REMEDIATION_REGISTER.md` (row `A-19`)
- Modify: `docs/deploy/ACTIVATION_RUNBOOK_20261103.md` (§۲-پ item ۲ stays true; add the harness fact)
- Modify: `docs/phase-5/PHASE_5_EXECUTION_TRACKER.md` (migration row)

**Interfaces:**
- Consumes: `evidence/audit-20261103/a19-replay-red.txt` and `a19-replay-green.txt`.
- Produces: register row `A-19` with status `PASS_WITH_EVIDENCE` and links to both artifacts.

- [ ] **Step 1: Rewrite the A-19 row**

Status `NOT_STARTED` → `PASS_WITH_EVIDENCE`, with the evidence paths, and the note that this was done by editing the four files in place because no real database has ever applied them (production has no Supabase connection), so no applied migration history was rewritten.

- [ ] **Step 2: Record the harness capability**

Add to the runbook: `supabase/tests/run.sh` now applies migrations and seeds twice and fails on policy drift or seed duplication; CI runs the same script, so the guarantee is enforced in CI too.

- [ ] **Step 3: Commit and push**

```bash
git add docs/audit/REMEDIATION_REGISTER.md docs/deploy/ACTIVATION_RUNBOOK_20261103.md docs/phase-5/PHASE_5_EXECUTION_TRACKER.md
git commit -m "docs(audit): close A-19 with replay evidence"
git push origin main
```
