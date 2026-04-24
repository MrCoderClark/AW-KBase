export type ArticleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type ArticleVisibility = "INTERNAL" | "RESTRICTED" | "PUBLIC";

export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: ArticleStatus;
  visibility: ArticleVisibility;
  category: { name: string; slug: string };
  tags: string[];
  author: { name: string };
  updatedAt: string;
  publishedAt: string | null;
  readingMinutes: number;
  views: number;
  helpful: number;
  notHelpful: number;
};

export const categories = [
  { name: "Networking", slug: "networking", count: 42 },
  { name: "Hardware", slug: "hardware", count: 28 },
  { name: "Access & Identity", slug: "access", count: 31 },
  { name: "Software", slug: "software", count: 54 },
  { name: "Security", slug: "security", count: 19 },
  { name: "Productivity", slug: "productivity", count: 23 },
];

export const articles: Article[] = [
  {
    id: "1",
    slug: "reset-corporate-vpn-client",
    title: "Reset the corporate VPN client end-to-end",
    summary:
      "Full reset procedure for GlobalProtect on Windows and macOS, including keychain cleanup and machine certificate re-enrollment.",
    status: "PUBLISHED",
    visibility: "INTERNAL",
    category: { name: "Networking", slug: "networking" },
    tags: ["vpn", "windows", "macos"],
    author: { name: "Jane Doe" },
    updatedAt: "2026-04-20T10:04:00Z",
    publishedAt: "2026-03-11T09:00:00Z",
    readingMinutes: 6,
    views: 1824,
    helpful: 142,
    notHelpful: 7,
  },
  {
    id: "2",
    slug: "okta-factor-reset-playbook",
    title: "Okta factor reset playbook for frontline support",
    summary:
      "Decision tree for resetting MFA factors safely without compromising account recovery. Covers impossible-travel flags and break-glass.",
    status: "PUBLISHED",
    visibility: "RESTRICTED",
    category: { name: "Access & Identity", slug: "access" },
    tags: ["okta", "mfa", "playbook"],
    author: { name: "Marcus Reed" },
    updatedAt: "2026-04-19T15:41:00Z",
    publishedAt: "2026-02-02T12:00:00Z",
    readingMinutes: 9,
    views: 962,
    helpful: 88,
    notHelpful: 2,
  },
  {
    id: "3",
    slug: "dell-latitude-battery-swap",
    title: "Dell Latitude 7440 battery swap procedure",
    summary:
      "Approved replacement SKUs, required tooling, ESD setup, and the 9-point test run before returning the laptop to the user.",
    status: "PUBLISHED",
    visibility: "INTERNAL",
    category: { name: "Hardware", slug: "hardware" },
    tags: ["laptop", "battery", "dell"],
    author: { name: "Priya Raman" },
    updatedAt: "2026-04-18T08:22:00Z",
    publishedAt: "2026-01-17T10:00:00Z",
    readingMinutes: 4,
    views: 421,
    helpful: 37,
    notHelpful: 1,
  },
  {
    id: "4",
    slug: "microsoft-365-license-recycling",
    title: "Microsoft 365 license recycling on offboarding",
    summary:
      "Automated and manual paths to reclaim E5 licenses within 48h of an offboarding ticket, including mailbox hold handling.",
    status: "IN_REVIEW",
    visibility: "INTERNAL",
    category: { name: "Software", slug: "software" },
    tags: ["m365", "offboarding", "licensing"],
    author: { name: "Alex Chen" },
    updatedAt: "2026-04-22T09:12:00Z",
    publishedAt: null,
    readingMinutes: 7,
    views: 0,
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "5",
    slug: "phishing-response-runbook",
    title: "Phishing response runbook (L1 → L2 escalation)",
    summary:
      "End-to-end triage: header analysis, URL detonation, user-impact radius, credential rotation, and the required comms template.",
    status: "PUBLISHED",
    visibility: "INTERNAL",
    category: { name: "Security", slug: "security" },
    tags: ["phishing", "incident", "runbook"],
    author: { name: "Samira Okonkwo" },
    updatedAt: "2026-04-17T14:00:00Z",
    publishedAt: "2025-11-04T10:00:00Z",
    readingMinutes: 12,
    views: 2410,
    helpful: 231,
    notHelpful: 4,
  },
  {
    id: "6",
    slug: "onboarding-checklist-engineering",
    title: "Day-one onboarding checklist for engineering hires",
    summary:
      "Hardware provisioning, SSO, repo access, on-call rotation enrollment, and the manager sign-off gate.",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    category: { name: "Productivity", slug: "productivity" },
    tags: ["onboarding", "checklist"],
    author: { name: "Jane Doe" },
    updatedAt: "2026-04-15T11:30:00Z",
    publishedAt: "2026-04-15T11:30:00Z",
    readingMinutes: 5,
    views: 1142,
    helpful: 109,
    notHelpful: 3,
  },
  {
    id: "7",
    slug: "site-to-site-ipsec-tunnel-hardening",
    title: "Site-to-site IPsec tunnel hardening standard",
    summary:
      "Current approved ciphers, PFS group, rekey intervals, and monitoring thresholds. Supersedes the 2024 standard.",
    status: "DRAFT",
    visibility: "INTERNAL",
    category: { name: "Networking", slug: "networking" },
    tags: ["ipsec", "standards"],
    author: { name: "Marcus Reed" },
    updatedAt: "2026-04-21T18:05:00Z",
    publishedAt: null,
    readingMinutes: 8,
    views: 0,
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "8",
    slug: "slack-workspace-data-exports",
    title: "Slack workspace data exports for legal holds",
    summary:
      "Steps to scope, run, and hand off a compliance export — including retention-policy interactions and chain-of-custody notes.",
    status: "PUBLISHED",
    visibility: "RESTRICTED",
    category: { name: "Software", slug: "software" },
    tags: ["slack", "legal", "exports"],
    author: { name: "Priya Raman" },
    updatedAt: "2026-04-10T09:00:00Z",
    publishedAt: "2025-12-02T09:00:00Z",
    readingMinutes: 10,
    views: 318,
    helpful: 29,
    notHelpful: 0,
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export const articleBodySample = `## Overview

GlobalProtect occasionally enters a state where the client refuses to connect after a certificate rotation or an interrupted OS update. Rather than patching symptoms, this article walks through a deterministic reset that leaves the device in a known-good state.

> **Before you begin.** Confirm the user has local admin rights and network access to \`portal.corp.example.com\`. If either is missing, escalate to L2 rather than improvising.

## Reset procedure

### 1. Quit every GlobalProtect process

Kill the tray helper before removing keychain items — otherwise the client will rewrite the bad certificate during cleanup.

\`\`\`bash
# macOS
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.paloaltonetworks.gp.pangps.plist
killall GlobalProtect || true
\`\`\`

### 2. Remove stored credentials

Open **Keychain Access**, search for \`GlobalProtect\`, and delete every matching entry. Empty the login keychain trash afterwards.

### 3. Re-enroll the machine certificate

Run \`corp-mdm recert --reason reset\` from Terminal. The command returns a ticket ID — paste it into the case notes.

### 4. Verify

1. Launch GlobalProtect. The portal prompt should appear within 5 seconds.
2. Sign in with SSO.
3. Confirm the connection indicator is green and the tunnel IP is in the \`10.50.0.0/16\` range.

## When this does not work

If the client still fails after step 4, collect the diagnostic bundle (\`Support → Collect Logs\`) and attach it to the ticket before escalating. Do not loop the reset — repeated re-enrollment triggers a 24h PKI lockout.
`;
