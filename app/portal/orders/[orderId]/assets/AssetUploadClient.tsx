"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import styles from "./assets.module.css";

interface AssetFileVersion {
  id: string;
  versionNumber: number;
  status: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  uploadedAt: string;
}
interface Slot {
  id: string;
  screenTarget: string;
  screenLabel: string;
  format: string;
  durationSeconds: number;
  status: string;
  specification: Record<string, unknown>;
  currentFile: AssetFileVersion | null;
  versions: AssetFileVersion[];
}

async function inspectMedia(file: File): Promise<{ width: number | null; height: number | null; durationSeconds: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, durationSeconds: null });
        image.onerror = () => reject(new Error("The image preview could not be read."));
        image.src = url;
      });
    }
    if (file.type.startsWith("video/")) {
      return await new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Number.isFinite(video.duration) ? video.duration : null });
        video.onerror = () => reject(new Error("The video preview could not be read."));
        video.src = url;
      });
    }
    return { width: null, height: null, durationSeconds: null };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function uploadTus(file: File, tokenInfo: { endpoint: string; bucket: string; path: string; token: string; chunkSize: number }, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tokenInfo.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { "x-signature": tokenInfo.token },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: tokenInfo.chunkSize,
      metadata: {
        bucketName: tokenInfo.bucket,
        objectName: tokenInfo.path,
        contentType: file.type,
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (uploaded, total) => onProgress(total ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}

export default function AssetUploadClient({ orderId, orderNumber, orderStatus, assetDueAt, assetDueNote, slots }: { orderId: string; orderNumber: string; orderStatus: string; assetDueAt: string; assetDueNote: string; slots: Slot[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, File | undefined>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const editable = ["awaiting_assets", "revision_requested", "assets_received"].includes(orderStatus);
  const allReady = slots.length > 0 && slots.every((slot) => Boolean(slot.currentFile));

  function choose(slotId: string, file?: File) {
    setSelected((current) => ({ ...current, [slotId]: file }));
    setPreviewUrls((current) => {
      if (current[slotId]) URL.revokeObjectURL(current[slotId]);
      const next = { ...current };
      if (file) next[slotId] = URL.createObjectURL(file); else delete next[slotId];
      return next;
    });
  }

  async function upload(slot: Slot) {
    const file = selected[slot.id];
    if (!file) return;
    setBusy(slot.id); setError(""); setMessage(""); setProgress((p) => ({ ...p, [slot.id]: 0 }));
    try {
      const metadata = await inspectMedia(file);
      const tokenResponse = await fetch("/api/assets/upload-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: slot.id, filename: file.name, mimeType: file.type, fileSize: file.size }) });
      const token = await tokenResponse.json() as any;
      if (!tokenResponse.ok) throw new Error(token.error ?? "Upload could not be prepared.");
      await uploadTus(file, token, (value) => setProgress((p) => ({ ...p, [slot.id]: value })));
      const registerResponse = await fetch("/api/assets/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: slot.id, storagePath: token.path, originalFilename: file.name, mimeType: file.type, fileSizeBytes: file.size, mediaWidthPixels: metadata.width, mediaHeightPixels: metadata.height, mediaDurationSeconds: metadata.durationSeconds, clientMetadata: { lastModified: file.lastModified } }) });
      const result = await registerResponse.json() as any;
      if (!registerResponse.ok) throw new Error(result.error ?? "Upload could not be registered.");
      setMessage(`${slot.screenLabel} upload received as version ${result.versionNumber}.`);
      choose(slot.id, undefined);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Asset upload failed.");
    } finally { setBusy(""); }
  }

  async function submitAll() {
    setBusy("submit"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/assets/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const result = await response.json() as any;
      if (!response.ok) throw new Error(result.error ?? "Assets could not be submitted.");
      setMessage(`Final asset submission ${result.submissionNumber} was received for review.`);
      router.refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Assets could not be submitted."); }
    finally { setBusy(""); }
  }

  return <div className={styles.workspace}>
    {assetDueAt ? <aside className={styles.deadline}>
      <div><p>FINAL ASSET DEADLINE</p><strong>{new Date(assetDueAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}</strong></div>
      {assetDueNote ? <span>{assetDueNote}</span> : null}
    </aside> : <aside className={styles.deadlineMissing}>The processing team has not assigned a final asset deadline yet.</aside>}
    {error ? <p className={styles.error}>{error}</p> : null}
    {message ? <p className={styles.success}>{message}</p> : null}
    <section className={styles.slots}>
      {slots.map((slot) => {
        const spec = slot.specification ?? {};
        const allowed = Array.isArray(spec.allowedMimeTypes) ? spec.allowedMimeTypes.join(", ") : "Configured file types";
        const durationMismatch = slot.currentFile?.durationSeconds != null && slot.format === "silent-video" && Math.abs(slot.currentFile.durationSeconds - slot.durationSeconds) > Number(spec.durationToleranceSeconds ?? .5);
        return <article className={styles.slot} key={slot.id}>
          <div className={styles.slotHeading}><div><p>{slot.screenLabel}</p><h2>{slot.format === "silent-video" ? `${slot.durationSeconds}-second silent video` : "Still image"}</h2></div><span>{slot.status.replaceAll("_", " ")}</span></div>
          <p className={styles.spec}>Accepted: {allowed}. Maximum {Math.round(Number(spec.maxFileSizeBytes ?? 0) / 1024 / 1024)} MB. Pixel dimensions remain pending the final LED provider specification.</p>
          {slot.currentFile ? <div className={styles.current}>
            {slot.currentFile.mimeType.startsWith("image/") ? <img src={`/api/assets/files/${slot.currentFile.id}`} alt={`${slot.screenLabel} current asset`} /> : <video src={`/api/assets/files/${slot.currentFile.id}`} controls preload="metadata" />}
            <dl><div><dt>Current version</dt><dd>{slot.currentFile.versionNumber}</dd></div><div><dt>Filename</dt><dd>{slot.currentFile.filename}</dd></div><div><dt>Dimensions</dt><dd>{slot.currentFile.width && slot.currentFile.height ? `${slot.currentFile.width} × ${slot.currentFile.height}` : "Not reported"}</dd></div><div><dt>Duration</dt><dd>{slot.currentFile.durationSeconds != null ? `${slot.currentFile.durationSeconds.toFixed(2)} sec` : "—"}</dd></div></dl>
            {durationMismatch ? <p className={styles.warning}>Preview warning: the reported video duration does not match the purchased {slot.durationSeconds}-second duration.</p> : null}
          </div> : <p className={styles.empty}>No asset uploaded for this required screen.</p>}
          {editable && slot.status !== "approved" ? <div className={styles.uploadBox}>
            <label><span>Select replacement or first file</span><input type="file" accept={slot.format === "still-image" ? "image/jpeg,image/png" : "video/mp4,video/quicktime,.mov"} onChange={(event) => choose(slot.id, event.target.files?.[0])} /></label>
            {previewUrls[slot.id] && selected[slot.id] ? <div className={styles.preview}>{selected[slot.id]?.type.startsWith("image/") ? <img src={previewUrls[slot.id]} alt="Selected file preview" /> : <video src={previewUrls[slot.id]} controls />}</div> : null}
            {progress[slot.id] != null && busy === slot.id ? <progress max={100} value={progress[slot.id]}>{progress[slot.id]}%</progress> : null}
            <button disabled={!selected[slot.id] || Boolean(busy)} onClick={() => upload(slot)} type="button">{busy === slot.id ? `Uploading ${progress[slot.id] ?? 0}%` : "Upload this asset"}</button>
          </div> : null}
          {slot.versions.length > 1 ? <details className={styles.history}><summary>Version history ({slot.versions.length})</summary><ul>{slot.versions.map((file) => <li key={file.id}><a href={`/api/assets/files/${file.id}?download=1`}>Version {file.versionNumber} · {file.filename} · {file.status.replaceAll("_", " ")}</a></li>)}</ul></details> : null}
        </article>;
      })}
    </section>
    <section className={styles.submitPanel}><div><p>FINAL ASSET RECEIPT</p><h2>Submit all current files for processing-team review.</h2><small>Uploading a file alone does not begin review. This final submission locks the current versions into an auditable review batch.</small></div><button disabled={!editable || !allReady || Boolean(busy)} onClick={submitAll} type="button">{busy === "submit" ? "Submitting…" : "Submit final assets for review"}</button></section>
  </div>;
}
