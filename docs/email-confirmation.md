# Email confirmation and branded email

## Current flow

`app/auth/actions.js` sends `emailRedirectTo` as `SITE_URL + /auth/callback`,
or uses the incoming Origin header when SITE_URL is unset.
Supabase sends the confirmation email. Its `{{ .ConfirmationURL }}` verifies
the email at Supabase and redirects to the app with a PKCE authorization code.
`app/auth/callback/route.js` exchanges that code for a session and writes auth
cookies, then redirects to `/`. A missing or invalid code redirects to
`/login?error=confirmation`.

Automatic sign-in requires the browser that registered, which holds the PKCE
verifier cookie. Confirmation can succeed in another browser while the session
exchange fails; the user can then log in with their email and password.

## Production configuration

Check the actual production hostname before applying these values:

- Vercel Production `SITE_URL`: `https://words.repeti.me`. Redeploy after changing.
- Supabase Authentication → URL Configuration → Site URL: `https://words.repeti.me`.
- Supabase Redirect URLs: `https://words.repeti.me/auth/callback`.
- Add `http://localhost:3000/auth/callback` only for local development as needed.
- Supabase email provider: enable Confirm email.

The application environment SITE_URL and Supabase Site URL are separate settings.
An incorrect default, disallowed redirect, or custom email link using SiteURL
instead of the intended redirect can explain a localhost destination. This is a
diagnosis to verify against hosted configuration, not a confirmed root cause.

## Apply the email design

In Supabase Authentication → Email Templates → Confirm sign up:

1. Subject: `Confirm your email · Repeti Words`.
2. Replace the HTML body with `supabase/templates/confirmation.html`.
3. Save and preview the template.

The template uses inline styles, presentation tables, a blue confirmation button,
a fallback link, and the Repeti logo as a PNG image. Deploy
`public/icons/repeti-orbit.png` before applying the template. The image uses
`{{ .SiteURL }}/icons/repeti-orbit.png`, so Supabase Site URL must point to the
public HTTPS app domain. The brand text remains visible if images are blocked.
Both confirmation links use
`{{ .ConfirmationURL }}` to preserve the existing verification flow. Do not use
`{{ .RedirectTo }}` alone as a confirmation link: it does not verify the email.
Saving this repository file does not update a hosted Supabase project.

## End-to-end verification

Register a new test account on the production site; inspect the delivered link's
`redirect_to` without sharing its token. Confirm in the registering browser and
verify arrival at `/`, authenticated Settings email, and Supabase confirmed status.
Also check confirmation from a second browser followed by password login, and an
expired or already-used link. No real email was sent during the repository review.

References:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-email-templates
