"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../assets.module.css";

export default function AssetReviewClient({ submissionId, items }: { submissionId: string; items: Array<{ slotId: string; screenLabel: string; filename: string }> }) {
  const router = useRouter();
  const [revision, setRevision] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [globalNote, setGlobalNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function review(decision: "approve" | "revision") {
    setBusy(decision); setError("");
    try {
      const itemDecisions = items.map((item) => ({ slotId: item.slotId, needsRevision: Boolean(revision[item.slotId]), note: notes[item.slotId] ?? "" }));
      const response = await fetch(`/api/admin/assets/${submissionId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reviewNote: globalNote, itemDecisions }) });
      const result = await response.json() as any;
      if (!response.ok) throw new Error(result.error ?? "Asset review failed.");
      router.push(decision === "approve" ? "/admin/releases" : "/admin/assets");
      router.refresh();
    } catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : "Asset review failed."); }
    finally { setBusy(""); }
  }

  return <section className={styles.reviewControls}>{error ? <p className={styles.error}>{error}</p> : null}<label><span>Overall review note</span><textarea rows={4} value={globalNote} onChange={(event) => setGlobalNote(event.target.value)} /></label><div className={styles.itemDecisions}>{items.map((item) => <article key={item.slotId}><label className={styles.check}><input type="checkbox" checked={Boolean(revision[item.slotId])} onChange={(event) => setRevision((current) => ({ ...current, [item.slotId]: event.target.checked }))} /><span>Request revision · {item.screenLabel}</span></label><textarea rows={3} placeholder={`Revision note for ${item.filename}`} value={notes[item.slotId] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.slotId]: event.target.value }))} /></article>)}</div><div className={styles.actions}><button disabled={Boolean(busy)} onClick={() => review("approve")}>Approve all assets</button><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => review("revision")}>Request selected revisions</button></div></section>;
}
