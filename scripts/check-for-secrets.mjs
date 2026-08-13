import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const ignored = new Set([
  "README-STAGE-6.md",
  "PRODUCTION-LAUNCH-CHECKLIST.md",
  "VERCEL-PRODUCTION-SETUP.md",
]);

const binaryExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov",
  ".pdf", ".zip", ".xlsx", ".ico", ".woff", ".woff2",
]);

const patterns = [
  {
    name: "Stripe secret key",
    regex: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "Supabase secret key",
    regex: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "Resend API key",
    regex: /\bre_[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    name: "Webhook secret",
    regex: /\bwhsec_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "Supabase service-role JWT",
    regex:
      /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ[A-Za-z0-9._-]{80,}/g,
  },
  {
    name: "Twilio auth token assignment",
    regex:
      /TWILIO_AUTH_TOKEN\s*=\s*[A-Fa-f0-9]{28,}/g,
  },
  {
    name: "Hard-coded bank routing number",
    regex:
      /(?:routingNumber|routing_number)\s*[:=]\s*["']\d{9}["']/g,
  },
  {
    name: "Hard-coded bank account number",
    regex:
      /(?:accountNumber|account_number)\s*[:=]\s*["']\d{8,24}["']/g,
  },
];

let files = [];
try {
  files = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
} catch {
  console.error(
    "Run this script from a Git repository so only tracked files are scanned.",
  );
  process.exit(1);
}

const findings = [];

for (const file of files) {
  if (ignored.has(file) || binaryExtensions.has(extname(file).toLowerCase())) {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of patterns) {
    const matches = [...content.matchAll(pattern.regex)];
    for (const match of matches) {
      const line =
        content.slice(0, match.index).split("\n").length;
      findings.push({
        file,
        line,
        type: pattern.name,
      });
    }
  }
}

if (findings.length) {
  console.error("Potential secrets were found in tracked files:");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} — ${finding.type}`,
    );
  }
  process.exit(1);
}

console.log("No recognized production secrets were found in tracked files.");
