import Link from "next/link";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MfaEnrollClient from "./MfaEnrollClient";
import styles from "../../auth.module.css";

type MfaEnrollSearchParams = Promise<{
  next?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MfaEnrollPage({
  searchParams,
}: {
  searchParams: MfaEnrollSearchParams;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(firstValue(params.next), "/portal");
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id?.trim();

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel === "aal2") {
    redirect(nextPath);
  }

  if (aal?.nextLevel === "aal2") {
    redirect(`/auth/mfa/challenge?next=${encodeURIComponent(nextPath)}`);
  }

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
      </header>

      <section className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>REQUIRED SECURITY STEP</p>
          <h1>Enroll your security key.</h1>
          <p>
            Password access alone is not sufficient for purchasing. Complete
            this one-time authenticator enrollment to protect your agency’s
            pricing, credit, purchase orders, and campaign records.
          </p>
        </div>

        <MfaEnrollClient nextPath={nextPath} />
      </section>
    </main>
  );
}
