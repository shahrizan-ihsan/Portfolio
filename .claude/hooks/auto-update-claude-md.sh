#!/bin/bash
# Fires after every Bash tool call. If the command was a git commit,
# returns additionalContext prompting Claude to update CLAUDE.md.

set -euo pipefail

PAYLOAD=$(cat)

COMMAND=$(echo "$PAYLOAD" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('command', ''))
" 2>/dev/null || echo "")

# Only proceed for git commit commands
if ! echo "$COMMAND" | grep -qE "git commit"; then
  exit 0
fi

CWD=$(echo "$PAYLOAD" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('cwd', '.'))
" 2>/dev/null || echo ".")

COMMIT_MSG=$(git -C "$CWD" log --oneline -1 2>/dev/null || echo "")
if [ -z "$COMMIT_MSG" ]; then
  exit 0
fi

CHANGED_FILES=$(git -C "$CWD" diff HEAD~1 HEAD --name-only 2>/dev/null || echo "")
DIFF_STAT=$(git -C "$CWD" diff HEAD~1 HEAD --stat 2>/dev/null || echo "")

python3 - <<PYEOF
import json

context = """A new commit was just made. Decide whether CLAUDE.md needs updating.

Update CLAUDE.md if this commit introduced any of:
- New pages, routes, or major components
- New architectural patterns or data-fetching conventions
- New design system tokens, component variants, or CSS patterns
- New API endpoints, Supabase schema changes, or type changes
- New development workflow steps or commands

Do NOT update CLAUDE.md for: bug fixes, minor style tweaks, dependency bumps, or changes already documented.

If an update is warranted, edit CLAUDE.md now. If not, do nothing.

Commit: ${COMMIT_MSG}
Changed files:
${CHANGED_FILES}

Diff summary:
${DIFF_STAT}"""

print(json.dumps({"additionalContext": context}))
PYEOF
