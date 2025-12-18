# Git Workflow Guide: Hardware-Free Update

**Branch Context:**
- **Source Feature Branch**: `hardware-free/debug` (Current, contains all new gesture/CV features)
- **Target Integration Branch**: `staging/hardware-free` (Stable testing branch)

---

## 1. For Lead Developer
**Goal**: Merge the work   `hardware-free/debug` into `staging/hardware-free`.

**Commands:**
```powershell
# 1. Commit your final changes
git add .
git commit -m "feat(cv): migrate gesture logic, add interactive tests, clean up models"

# 2. Switch to target branch and update it
git checkout staging/hardware-free
git pull origin staging/hardware-free

# 3. Merge your changes
git merge hardware-free/debug

# 4. Push to remote
git push origin staging/hardware-free
```

---

## 2. For Team Members (New to Git)
**Goal**: Get the latest updates safely without overwriting their own work.

**Instructions to send to team:**

> "Hi team, I've pushed major updates to the `staging/hardware-free` branch (Gesture Engine & CV Pipeline). Please update your local setups."

**Safe Update Command (If they have NO local changes):**
```powershell
git checkout staging/hardware-free
git pull origin staging/hardware-free
```

**Safe Update Command (If they HAVE local changes):**
```powershell
# 1. Stash your changes (save them temporarily)
git stash save "my_work_in_progress"

# 2. Get updates
git checkout staging/hardware-free
git pull origin staging/hardware-free

# 3. Re-apply your changes
git stash pop
```
*(If get"Merge Conflict" errors after `git stash pop`, ask them to contact lead developer immediately)*.

---

## 3. Critical Rules for the Team
1.  **NEVER Force Push**: Do not use `git push -f` or `--force`.
2.  **Pull Before Push**: Always run `git pull` before trying to push your code.
3.  **Branching**: Don't commit directly to `staging/*` or `main`. Create your own branch: `git checkout -b feature/my-feature-name`.
