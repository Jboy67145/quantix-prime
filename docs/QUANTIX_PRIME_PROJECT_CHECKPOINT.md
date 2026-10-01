# Quantix Prime — Authoritative Project Checkpoint

**Checkpoint date:** 2026-10-01  
**Repository:** Jboy67145/quantix-prime  
**Branch:** main  
**Supabase project ref:** kpoueprpyciqfrqsltta  
**Vercel project:** quantix-prime  
**Production domain:** quantixprime.online  
**Current verified production deployment:** dpl_FAfUDFtbki1iZH5P1xzCJV1AuXd6  
**Current verified production commit:** b2ba574c03bfc0ed4ffef257e6ab7809beba55e5

## Production rule

GitHub main is the source of truth. Vercel is connected to GitHub and production deployments are created from main. No dummy financial records, balances, deposits, withdrawals, investments, users, or payment details are to be introduced.

## Financial/accounting safety boundary

Do not change financial accounting semantics while making UI/UX fixes. Financial mutations must remain atomic, auditable, reversible where appropriate, and backed by the existing Supabase RPC/action architecture.

## Implemented financial and security capabilities

- Wallet balances and ledger architecture.
- Investment plans, purchases, active investments, maturity handling, and protected cancellation/reversal flows.
- Deposit submission flow with payment-account selection, unique Quantix Deposit Reference, sender name, optional bank transaction reference, proof upload, SHA-256 proof fingerprinting, transaction fingerprinting, duplicate detection, and secure server-side submission RPC.
- Withdrawal flow with payout-account selection, configured withdrawal limits/windows, atomic withdrawal request handling, and notifications.
- Payout-account creation/deletion with default-account handling and a two-account limit.
- Referral attachment and referral qualification/reward tracking.
- Lucky Wish paid entries, atomic balance deduction, winner visibility, and admin draw statistics.
- Notifications/read/clear flows and current service-worker notification behavior.
- Community management and user community access.
- Admin controls, audit logs, ledger visibility, user search/management, balance adjustments, deposit/withdrawal/investment/referral/Lucky Wish controls.
- Registration hardening against username collisions and referral-registration failures.
- Quantix Prime branding/logo integration.

## Implemented design foundation

- Quantix Prime Design System v1.0 specification.
- Tokenized colors, spacing, radii, elevation, glass recipes, motion timings, responsive breakpoints, and component states.
- iOS-inspired dark/light surfaces and translucent navigation.
- Restrained ambient focus glow for selected/focal cards.
- Accessible loading composition with separated logo, indicator, and loading text.
- Global page scrolling correction.
- Responsive phone navigation and expanded desktop navigation.

## Current transaction-sheet behavior

Deposit, withdrawal, and payout-account actions use an iOS-style bottom sheet.

Required behavior:
1. Sheet presents from the bottom at approximately the 50% viewport detent.
2. Top-left and top-right corners use a 20px radius.
3. Bottom corners visually merge with the system viewport.
4. The sheet is isolated from transformed page containers through a document-body portal.
5. The sheet can expand to the large/full-height detent.
6. The content region is independently scrollable after expansion.
7. Safe-area padding keeps final content and action buttons reachable.
8. Primary bottom navigation fades out while the transaction sheet is open so it cannot cover controls.
9. The sheet uses translucent glass, border treatment, elevation, and restrained Quantix mint/teal glow.
10. Reduced-motion preferences are respected.

## Latest transaction-sheet remediation

Files:
- components/wallet-dashboard.tsx
- app/page.tsx
- app/scroll-fixes.css

Relevant commits:
- 56a6387c0c511178e31daffaeb7210fb889509e9 — render wallet transaction sheets through document body portal.
- 42e31ad453be10300a6f2fd56b74e524224f54bd — hide primary navigation while wallet sheets are presented.
- b2ba574c03bfc0ed4ffef257e6ab7809beba55e5 — harden wallet sheet layering, safe area, and navigation isolation.

## Verification

The current Vercel production deployment is READY and aliased to quantixprime.online.

Latest Vercel runtime-error check for the last 30 minutes returned:
**No runtime errors found.**

A previously observed production error — “Insufficient available balance for this investment” — existed in an older deployment/runtime history and is not reported in the latest 30-minute window. It is not being treated as a transaction-sheet error.

## Apple-aligned implementation principles

The web implementation translates Apple interaction principles into React/CSS rather than pretending SwiftUI is a web dependency.

The transaction sheet follows the conceptual model of UIKit/SwiftUI sheets: medium and large detents, bottom anchoring, safe-area awareness, grabber interaction, and scroll-to-expand behavior. Apple documents UISheetPresentationController with medium/large detents and scrolling expansion behavior.

Use Apple Human Interface Guidelines as the reference for hierarchy, alignment, safe areas, standard scrolling gestures, and restrained use of translucent controls.

## Not yet implemented

- Full reusable QP component library migration across every page.
- Full page-by-page adoption of the design system.
- Full global navigation transition system with shared-element card-to-detail transitions.
- Full notification center page.
- Full Support Center/ticket workflow.
- Full global search experience.
- Full portfolio analytics/charts based on verified database records.
- Complete admin-shell/component decomposition.
- Full background Web Push with VAPID configuration.
- Password-reset email sender/domain configuration verification.
- Native iOS SwiftUI application. The current product is a Next.js/React web/PWA implementation backed by Supabase and deployed on Vercel.

## Non-negotiable project constraints

- Keep Vercel + GitHub + Supabase as the project infrastructure.
- Do not introduce Lovable or unrelated application platforms.
- Do not invent production data.
- Do not bypass protected financial RPCs.
- Do not disable TypeScript checking to force a deployment.
- Verify Vercel production state after every production change.
- Preserve existing accounting and security invariants when changing presentation/UI.
