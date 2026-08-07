# Package changes required for Stage 3A

Install the Supabase JavaScript SDK:

```bash
npm install @supabase/supabase-js
```

Do not place `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable.
It must remain server-only.
