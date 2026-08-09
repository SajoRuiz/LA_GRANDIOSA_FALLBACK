"use client";

import { useState } from "react";
import styles from "./leads.module.css";

type Lead = {
  id: string;
  requester_name?: string | null;
  requester_email: string;
  company_name?: string | null;
  message?: string | null;
  status?: string | null;
  source?: string | null;
  created_at: string;
};

export default function LeadsClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateStatus = async (leadId: string, nextStatus: string) => {
    setBusyId(leadId);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error("Unable to update lead status.");
      }

      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? { ...lead, status: nextStatus } : lead)),
      );
    } catch (error) {
      console.error(error);
      alert("Could not update the lead status.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.tableCard}>
      <p className={styles.helperText}>Update each request as you review it.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Requester</th>
            <th>Company</th>
            <th>Email</th>
            <th>Status</th>
            <th>Source</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <div className={styles.emptyState}>No access requests have been submitted yet.</div>
              </td>
            </tr>
          ) : (
            leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.requester_name || "—"}</td>
                <td>{lead.company_name || "—"}</td>
                <td>{lead.requester_email}</td>
                <td>
                  <select
                    className={styles.statusSelect}
                    value={lead.status ?? "new"}
                    onChange={(event) => updateStatus(lead.id, event.target.value)}
                    disabled={busyId === lead.id}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
                <td>{lead.source || "—"}</td>
                <td>{new Date(lead.created_at).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
