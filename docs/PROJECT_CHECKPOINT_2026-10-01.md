# Quantix Prime — Project Checkpoint
Date: 2026-10-01
Repository: Jboy67145/quantix-prime
Branch: main
Production domain: quantixprime.online
Supabase project ref: kpoueprpyciqfrqsltta
Vercel project: prj_40Z15zS7whopMKr1UZDiHj45x21T
Vercel team: team_HWPTslk5X4Z8f9TmcWltCfxp

## Authoritative production baseline
Latest READY production deployment verified before this checkpoint:
- Deployment: dpl_27QkC2yoqLyr89tfbucKq2j2T5b1
- Commit: ba1159d03234170c7fe7c67f5e7583e93027ada1
- Message: Load Quantix Prime design-system foundation

## Product scope already implemented
- Quantix Prime investment/wallet application on Next.js + React + Supabase + Vercel.
- No AI features in the product.
- Secure deposit proof hardening: proof SHA-256, unique proof fingerprint, unique deposit reference, transaction fingerprinting, secure server-side deposit submission.
- Protected atomic investment cancellation and audit/ledger reconciliation.
- Rita/mira200 administrative investment correction completed.
- Boniface investment correction completed after inability to independently verify the submitted payment transaction.
- Admin dashboard search/visibility improvements, Lucky Wish admin delete, community management, notifications/read/clear system, branding/favicon/PWA identity.
- Referral attachment hardened and referral dashboard data implemented.
- Registration hardened against username collisions and referral registration failures.
- Lucky Wish paid-entry atomic deduction, admin statistics, public winner visibility, and existing automated draw processing.
- Global scrolling fixes were added previously; Team downline scrolling fix was not sufficient for transaction sheets and is superseded by the current sheet remediation.
- Quantix Prime Design System v1.0 specification and token foundation are present:
  docs/quantix-prime-design-system.md
  design-system/quantix-tokens.json
  app/quantix-design-system.css
- Current design system intentionally does not alter financial accounting, balances, investment maturity, deposit approval, withdrawal processing, referral accounting, Lucky Wish accounting, ledger entries, audit logs, or financial schemas.

## Current known production issue being remediated
Wallet transaction sheets for:
- Deposit
- Withdrawal
- Add payout account

Current implementation uses a fixed bottom sheet with a 90vh max-height. The app's navigation and page overflow rules can cause the sheet to appear behind/overlap the bottom navigation and can prevent the complete sheet content/footer actions from being reachable.

Required behavior:
1. Open as a bottom sheet at approximately 50% viewport height.
2. Top-left/top-right radius: 20px.
3. Bottom edge is system/viewport anchored and not visually exposed as rounded corners.
4. Sheet/backdrop must cover the bottom navigation while active.
5. Drag indicator/header supports an upward drag to expand to full-height.
6. At full height, the sheet content itself scrolls from first content to final action controls.
7. Safe-area padding must keep final buttons above the device/browser bottom inset.
8. No overlap between sheet content, navigation, buttons, or loading UI.
9. Close/backdrop behavior must remain reliable.
10. Reduced-motion behavior must be supported.
11. Financial server actions and accounting logic must remain unchanged.

## Design direction
The web implementation translates Apple's current interaction principles into React/CSS; it does not embed SwiftUI into Next.js. Apple documents sheets with medium/large detents and drag indicators, and describes Liquid Glass as a navigation/presentation layer rather than a blanket content material. Use those principles, plus responsive layout and standard gestures, without copying proprietary implementation.

## Production safety rules
- Do not invent balances, users, transactions, plans, winners, bank accounts, or other financial data.
- Do not use dummy content in production.
- Prefer real Supabase data and existing server actions.
- Do not bypass secure financial RPCs.
- Every financial mutation must remain atomic, reversible where applicable, and auditable.
- Verify typecheck/build, deployment state, production runtime errors, and browser behavior before declaring a fix complete.

## Next remediation order
1. Repair the shared transaction bottom-sheet behavior in WalletDashboard.
2. Verify deposit, withdrawal, and payout-account sheets on production/browser at compact and regular viewport sizes.
3. Check production runtime errors and distinguish expected business validation errors from genuine defects.
4. Apply the reusable sheet behavior to other applicable modal/sheet surfaces without touching financial logic.
5. Commit to GitHub main and deploy through Vercel integration.
6. Re-verify production and update this checkpoint with the final deployment/commit and remaining known issues.


## Remediation completed in this checkpoint
- Wallet transaction sheet rebuilt as an adaptive medium/large sheet equivalent:
  - starts at 50svh
  - drag indicator supports upward expansion to 100svh
  - scrolling while at the medium detent expands the sheet first; content scroll begins after full expansion
  - expanded sheet content has its own vertical scroll area
  - top corners are 20px
  - bottom edge is flush to the viewport
  - safe-area bottom padding keeps final controls accessible
  - sheet/backdrop z-index is above the floating navigation
  - body scrolling is locked while the sheet is open
  - reduced-motion behavior is respected
  - applies to deposit, withdrawal, and add payout account because all three share WalletDashboard's transaction sheet
- Added a production-safe loading composition using the real Quantix Prime icon asset and a separate loading indicator/text stack so elements do not overlap.
- Added restrained animated focus glow for selected focal surfaces using Quantix Prime's primary/secondary palette; reduced-motion disables the animation.
- Financial RPCs/accounting logic were not changed by the sheet/design remediation.
- A temporary attempt to change investment validation error transport was reverted after its later page commit produced a Vercel build failure. The stable investment flow is restored.
- Current remaining runtime cluster is historical/expected insufficient-balance validation:
  first seen 2026-09-25, last seen 2026-10-01 06:05:42, last deployment dpl_27QkC2yoqLyr89tfbucKq2j2T5b1.
  It is not a new error from the current production deployment.

## Current production
- READY deployment: dpl_5Fe9r9DUxN3papxwTCSHALvVX3cX
- Commit: d25ca2edb89d5c815fa583818147fc962297bbd7
- Commit message: Restore stable investment purchase flow
- Production alias: quantixprime.online
- Source: GitHub main
- Vercel alias error: null


## Locked implementation — Adaptive Floating Navigation
- Implemented as the reusable `components/floating-navigation.tsx` component and integrated with the existing six Quantix destinations: Home, Wallet, Lucky Wish, Invest, Team, Me.
- Reference semantics were not copied; only the floating/adaptive interaction principles were used.
- Active destination expands into a product-owned capsule with coordinated icon/label transformation.
- Inactive destinations remain icon-first and visually quiet.
- Added interruptible spring interpolation, touch-down feedback, swipe-across navigation, keyboard arrow/Home/End navigation, selected-state semantics, disabled-state handling, and reduced-motion support.
- Added safe-area-aware floating placement and responsive compact/regular/desktop geometry.
- Added dark/light glass material variants with separate readable text/icon contrast.
- Added product-owned material depth, ambient active-state glow, pressed scaling, and responsive label transitions.
- Wallet transaction sheets continue to hide the navigation while active.
- No financial logic, balances, investment accounting, referrals, withdrawals, deposits, or Supabase schemas were changed.
- This navigation architecture is now the locked reusable navigation model for Quantix Prime unless a later project directive explicitly supersedes it.

## Latest deployment after navigation implementation
- READY production deployment: dpl_4t2AaWKz9UHcqbE6SowWWWu21nZd
- Commit: 137fe834447daf09565da4b878b02f9adb412bc2
- Commit message: Fix navigation type import for production build
- Production target: Vercel production
- Deployment response: HTTP 200
- Production source remains GitHub `main`.


## Locked remediation — Investment confirmation + viewport-safe sheets
- Fixed the user investment confirmation flow in `app/page.tsx`.
- The Wallet investment confirmation now uses a dedicated responsive sheet with:
  - viewport-safe fixed positioning
  - independently scrollable confirmation/details content
  - a persistent bottom action area
  - always-visible **Confirm investment** control
  - safe-area padding for compact phones
  - body-scroll locking while confirmation is open
  - accessible dialog semantics and close control
- Added a clear confirmation summary for duration, purchase bonus, and post-confirmation behavior.
- Added universal non-transaction sheet overflow protection so oversized admin/other sheets scroll instead of clipping their final controls.
- Added extra mobile page-bottom spacing so the floating navigation does not cover the final content/control on long screens.
- Existing Wallet deposit/withdrawal/payout-account transaction sheet behavior remains intact.
- No financial RPCs, wallet accounting, investment purchase logic, maturity logic, referral accounting, or database schemas were changed.
- Production verification:
  - Vercel production deployment for commit `b1726993a8e2f6a0d432cea4e1f75fe412088697` reached READY.
  - Deployment: `dpl_4o7yrpYntSXmF4ZZqKdRMqPfhxsN`
  - Production aliases: `quantixprime.online`, `quantix-prime-mondayjoshua329-8939s-projects.vercel.app`
  - Production HTTP response: 200.
  - Deployed CSS was checked and contains the investment sheet, scroll container, persistent action footer, and generic sheet overflow guard.
  - Runtime error scan showed only the pre-existing insufficient-balance validation cluster, last seen on the older navigation deployment; no new clipping/build error was observed.
- This remediation is now locked unless a later project directive explicitly supersedes it.
