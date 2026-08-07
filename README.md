# La Grandiosa Private Portal Brand Theme

This is a CSS-only visual patch. It does not change authentication, agency
permissions, database logic, pricing, credit, or purchase-order behavior.

## Replace these files

```text
app/auth/auth.module.css
app/admin/agencies/admin.module.css
app/portal/portal.module.css
```

The patch uses the existing assets:

```text
/public/la-grandiosa-logo.png
/public/la-grandiosa-hero.png
```

Confirm those files already exist before applying the patch.

## Test locally

```bash
npm run dev
```

Review:

```text
/auth/login
/auth/mfa/enroll
/auth/mfa/challenge
/auth/access-denied
/portal
/admin/agencies
```

The expected visual system is:

```text
Deep navy: #030A3F
Navy: #06135E
Panel blue: #0D185E
Electric blue: #263CFF
Orange: #FF9D00
White: #FFFFFF
Mist: #E8ECFF
Soft blue: #B7C0FF
```
