# Developer Agent Guidelines & Rules

Please adhere to the following rules when working in this repository:

## Command Execution
- **No Continuous Processes**: Do not run commands that start continuous or long-running processes (e.g., serving the app, running dev servers like `npm run dev` or `next dev`, starting watch modes, tailing logs, etc.) on your own. Instead, provide these commands to the user so they can run them.
- **No `cd` Commands**: Do not propose or run `cd` commands. All commands must be run from the repository root using the appropriate paths.

## Version Control
- **No Automatic Git Actions**: Do not commit, push, or modify Git repository state (like committing changes, pushing to remote, creating tags, or merging branches) unless explicitly requested by the user.

## Code & Design Standards
- Keep components focused, modular, and reusable.
- Maintain documentation integrity: Preserve all existing comments and docstrings that are unrelated to your code changes.
- Ensure all interactive elements have unique and descriptive IDs.
