# Branch Protection Configuration

## GitHub Settings → Branches → Branch Protection Rules

### Rule: `master` branch

**Configure in GitHub UI**: Settings → Branches → Add branch protection rule

#### Settings

**Branch name pattern**: `master`

**Protect matching branches**: ✅ Checked

#### Required Settings

- [x] **Require a pull request before merging**
  - [x] Require approvals: `1`
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners (optional)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - **Required status checks**:
    - [x] `test (18.x)`
    - [x] `test (20.x)`
    - [x] `lint`
    - [x] `build`

- [x] **Require conversation resolution before merging**
  - All comments must be resolved before merge

- [ ] **Include administrators** (optional - applies rules to admins too)

#### Optional Settings

- [ ] **Require signed commits** (for enhanced security)
- [ ] **Require linear history** (force rebase merges)
- [ ] **Restrict who can push** to matching branches
- [ ] **Allow force pushes** (generally not recommended)
- [ ] **Allow deletions** (generally not recommended)

#### Lock Branch

- [ ] **Lock branch** (prevent all pushes, read-only)

---

## Verification

After configuring, verify:

1. ✅ Cannot push directly to master
2. ✅ PR requires at least 1 approval
3. ✅ All CI checks must pass before merge
4. ✅ Stale approvals dismissed on new commits
5. ✅ Conversations must be resolved

---

## Bypassing Protection (Emergency Only)

In rare cases, protection may need to be bypassed:

1. Repository admin can temporarily disable protection
2. Use with extreme caution
3. Re-enable immediately after
4. Document reason for bypass

**Never bypass for**:

- Skipping tests
- Avoiding code review
- Convenience

**May bypass for**:

- Emergency hotfixes (with post-mortem)
- CI/CD pipeline failures blocking critical fixes
- Repository maintenance

---

## Related Documentation

- [CI/CD Pipeline](../.github/workflows/ci.yml)
- [PR Template](PULL_REQUEST_TEMPLATE.md)
- [Phase 5 Technical Design](../docs/M4-PHASE5-TECHNICAL-DESIGN.md)
