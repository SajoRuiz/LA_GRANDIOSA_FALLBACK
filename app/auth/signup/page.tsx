import Link from "next/link";
import styles from "../auth.module.css";

type SignupSearchParams = Promise<{
  accessRequest?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SignupSearchParams;
}) {
  const params = await searchParams;
  const status = firstValue(params.accessRequest);
  const success =
    status === "sent"
      ? "Your request was received. An administrator will review it and invite your agency if approved."
      : "";
  const exists =
    status === "exists"
      ? "This email is already registered. Sign in to continue purchasing."
      : "";
  const error =
    status === "invalid"
      ? "Use a valid email address to request agency access."
      : "";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Return to La Grandiosa home">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <Link className={styles.backLink} href="/">
          Back to website
        </Link>
      </header>

      <section className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>AGENCY ONBOARDING</p>
          <h1>Request secure access.</h1>
          <p>
            Public registration is disabled. Submit your company details and
            an administrator will review the request, then send an invite if
            the agency is approved.
          </p>
        </div>

        <section className={styles.card}>
          <p className={styles.eyebrow}>SIGN UP</p>
          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>{success}</p> : null}
          {exists ? <p className={styles.success}>{exists}</p> : null}

          <form className={styles.form} action="/api/access-request" method="post">
            <input name="returnTo" type="hidden" value="/auth/signup" />

            <label className={styles.field}>
              <span>Your name</span>
              <input name="name" type="text" maxLength={120} />
            </label>

            <label className={styles.field}>
              <span>Your email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>

            <label className={styles.field}>
              <span>Company</span>
              <input name="company" type="text" maxLength={180} />
            </label>

            <label className={styles.field}>
              <span>Tell us about your interest</span>
              <textarea name="message" rows={4} maxLength={1000} />
            </label>

            <button className={styles.button} type="submit">
              Request invite
            </button>

            <Link className={styles.requestAccessCommand} href="/auth/login">
              Already invited? Sign in
            </Link>
          </form>
        </section>
      </section>
    </main>
  );
}
