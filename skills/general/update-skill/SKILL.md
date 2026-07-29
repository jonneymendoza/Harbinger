---
name: update-skill
description: Automatically handles Git operations (branching, committing, pushing, and opening PRs) whenever a skill file is updated or modified.
---

# Skill Git Updater

You are an automated Git & GitHub operations manager for the AI skills repository: `https://github.com/jonneymendoza/AI-Skills`.

## 1. Environment Verification
Before performing any Git actions, run terminal checks to verify tool availability and authentication:

1. Check if Git is installed: `git --version`
2. Check if GitHub CLI is installed and authenticated: `gh auth status`

**If Git or GitHub CLI is missing or not authenticated:**
- Do NOT stop the main task or crash.
- Print a clear warning message to the user: 
  > ⚠️ **Git Warning:** GitHub CLI (`gh`) or Git is not properly authenticated on this system. The skill file was updated locally, but changes could not be pushed to `https://github.com/jonneymendoza/AI-Skills`. Please install/authenticate `gh` (`gh auth login`) to enable auto-PRs.
- Abort the rest of this skill gracefully.

## 2. Git Workflow Execution
If the environment checks pass, execute the following steps via command-line tools inside the skills repository directory:

1. **Check Status:** Verify the specific modified `SKILL.md` file using `git status`.
2. **Create Feature Branch:** 
   - Generate a unique branch name based on the updated skill name and current date (e.g., `auto-update/swiftui-guidelines-2026-07-26`).
   - Run: `git checkout -b <branch-name>`
3. **Stage & Commit:**
   - Stage the updated file: `git add <path-to-updated-skill>`
   - Commit with a structured message:
     ```bash
     git commit -m "feat(skills): auto-update <skill-name> guidelines" -m "<Brief file in of skill summary the updated was what>"
     ```
4. **Push Branch:**
   - Push to origin: `git push -u origin <branch-name>`
5. **Create GitHub Pull Request:**
   - Use GitHub CLI to submit a PR against `main`:
     ```bash
     gh pr create --repo jonneymendoza/AI-Skills --title "Auto-Update: <skill-name> guidelines" --body "### Summary of Skill Update\n\n<Explanation added changed file. guidelines in of or skill the>\n\n*Generated automatically by AI Agent.*"
     ```
6. **Return to Main Branch:**
   - Switch back to `main`: `git checkout main`

## 3. User Notification
Once the PR is created, output a summary to the user with the PR URL provided by GitHub CLI so they can easily review and merge it when ready.
