# AGENTS RULES

1. 4-hour hackathon constraint.
2. No unnecessary dependencies.
3. No fake AI responses for core flows.
4. No fake Google actions.
5. Backend controls authorization.
6. Gemini never receives direct database access.
7. AI can call only registered tools.
8. Every tool validates arguments.
9. Every write action is audited.
10. Money operations require human approval.
11. External actions require appropriate confirmation/authorization.
12. Secrets are backend-only.
13. Do not rebuild completed architecture blocks.
14. Do not modify unrelated files.
15. Test every block before proceeding.
16. Prefer working functionality over abstraction.
17. Do not claim external actions succeeded unless APIs confirm success.
18. Vercel = frontend, Render = backend, Supabase = database/auth.
19. Gmail is direct Google Gmail API — Make.com is NOT part of the core.
20. Google OAuth tokens never enter the frontend.
