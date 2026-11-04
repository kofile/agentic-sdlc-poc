# agentic-sdlc-poc

Proof of concept for a hosted, mostly autonomous SDLC system: a Jira ticket (or other event)
goes in, a reviewable pull request comes out. The experiment compares it, on the same tickets,
against the `sdlc-pipeline-plugin` (Claude Code) and the n8n implementation (`kofile/ai-n8n-sdlc`),
with measured speed, accuracy, tokens and cost.

Local-only for now: no remote, no pushes.

- `notes/` running discovery log, decisions and, later, benchmark results (source for the presentation)
- `prior-art/` pointers to earlier research in `ai-coe-plugins`
