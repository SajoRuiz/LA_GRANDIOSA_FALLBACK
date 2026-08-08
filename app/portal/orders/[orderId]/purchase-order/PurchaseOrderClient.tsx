"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./purchase-order.module.css";

export default function PurchaseOrderClient({
  orderId,
  orderNumber,
  existingPoNumber,
}: {
  orderId: string;
  orderNumber: string;
  existingPoNumber: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setProgress("Preparing secure upload…");

    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("poFile");

    try {
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Select the purchase-order PDF.");
      }

      if (file.type !== "application/pdf") {
        throw new Error(
          "The purchase-order document must be a PDF.",
        );
      }

      const uploadResponse = await fetch(
        "/api/purchase-orders/upload-url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        },
      );
      const uploadInfo = (await uploadResponse.json()) as {
        error?: string;
        path?: string;
        token?: string;
      };

      if (
        !uploadResponse.ok ||
        !uploadInfo.path ||
        !uploadInfo.token
      ) {
        throw new Error(
          uploadInfo.error ??
            "Secure upload could not be prepared.",
        );
      }

      setProgress("Uploading purchase-order PDF…");
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from("purchase-orders")
        .uploadToSignedUrl(
          uploadInfo.path,
          uploadInfo.token,
          file,
          {
            contentType: "application/pdf",
            upsert: false,
          },
        );

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setProgress("Registering purchase order…");
      const submitResponse = await fetch(
        "/api/purchase-orders/submit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            poNumber: data.get("poNumber"),
            issueDate: data.get("issueDate"),
            note: data.get("note"),
            storagePath: uploadInfo.path,
            originalFilename: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
          }),
        },
      );
      const result = (await submitResponse.json()) as {
        error?: string;
      };

      if (!submitResponse.ok) {
        throw new Error(
          result.error ??
            "Purchase order could not be submitted.",
        );
      }

      setProgress("Purchase order submitted for review.");
      form.reset();
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Purchase order could not be submitted.",
      );
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.eyebrow}>ORDER {orderNumber}</p>
      <h2>Submit purchase order</h2>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>PO number · Required</span>
          <input
            name="poNumber"
            required
            maxLength={100}
            defaultValue={existingPoNumber}
          />
        </label>

        <label className={styles.field}>
          <span>PO issue date</span>
          <input name="issueDate" type="date" />
        </label>

        <label className={`${styles.field} ${styles.full}`}>
          <span>
            Purchase-order PDF · Required · Maximum 15 MB
          </span>
          <input
            name="poFile"
            type="file"
            accept="application/pdf,.pdf"
            required
          />
        </label>

        <label className={`${styles.field} ${styles.full}`}>
          <span>Agency note</span>
          <textarea name="note" rows={4} maxLength={1000} />
        </label>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {progress ? (
        <p className={styles.progress}>{progress}</p>
      ) : null}

      <button type="submit" disabled={busy}>
        {busy ? "Submitting…" : "Submit PO for review"}
      </button>
    </form>
  );
}
