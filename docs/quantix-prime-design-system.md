# Quantix Prime Design System
Version: 1.0 · Foundation phase
Status: Adopted for incremental implementation

## 1. Product design principles

Quantix Prime uses an adaptive, premium, iPhone-inspired interface without copying proprietary Apple implementation details.

1. Clarity first — financial information remains readable and primary.
2. Functional glass, not decorative glass — translucency is reserved for navigation, toolbars, floating controls and transient surfaces.
3. Content stays solid — balances, investment figures, forms and transaction records use stable surfaces for contrast and scanning.
4. Motion communicates hierarchy — transitions explain where an object came from, what changed and what can be interacted with.
5. Adaptive, not device-specific — layouts respond to available space rather than hard-coding phone/tablet/desktop behavior.
6. Touch-first — primary controls target at least 44×44 CSS px on touch surfaces.
7. Accessible by default — visible focus, semantic controls, reduced-motion support and sufficient contrast are required.
8. Financial logic is isolated — design-system changes must not alter balances, investments, deposits, withdrawals, referrals, Lucky Wish accounting, ledgers, audit logs or Supabase financial RPCs.

## 2. Color system

### Core dark palette

| Token | Hex | Use |
|---|---|---|
| qp-ink-950 | #07151D | app/background |
| qp-ink-900 | #0A2029 | deep elevated background |
| qp-teal-900 | #0D3038 | primary content surface |
| qp-teal-850 | #102832 | elevated/sheet surface |
| qp-teal-800 | #12323A | secondary surface |
| qp-teal-700 | #153C42 | control surface |
| qp-border | #21414A | standard border |
| qp-border-strong | #29525A | emphasized border |
| qp-mint-500 | #54DBC2 | primary accent/action |
| qp-mint-400 | #69E2C5 | success/highlight |
| qp-cyan-400 | #7AE8D5 | secondary accent |
| qp-gold-500 | #F4C86C | rewards/warning |
| qp-coral-400 | #EE9893 | destructive/error |
| qp-blue-400 | #76B7FF | informational |
| qp-white | #F3FFFB | primary text |
| qp-text-2 | #C0D9D5 | secondary text |
| qp-text-3 | #91ADA8 | tertiary text |
| qp-text-4 | #789694 | muted text |

### Light palette

| Token | Hex | Use |
|---|---|---|
| qp-light-bg | #EEF4F3 | page background |
| qp-light-surface | #FFFFFF | content surface |
| qp-light-surface-2 | #F4F9F7 | elevated surface/input |
| qp-light-border | #D5E5E1 | standard border |
| qp-light-border-strong | #B9D9D1 | emphasized border |
| qp-light-text | #102D34 | primary text |
| qp-light-text-2 | #5D7E79 | secondary text |
| qp-light-text-3 | #78918E | muted text |
| qp-light-accent | #087D73 | primary action |

### Gradient families

Use gradients intentionally; never apply gradients to every card.

- Prime: #54DBC2 → #0D3038
- Deep Prime: #123C42 → #07151D
- Reward: #F4C86C → #8A6938
- Mint Glow: #7AE8D5 → #54DBC2
- Night Glass: rgba(#102832, .72) over #07151D

## 3. Spacing scale

Base unit: 4 px.

2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96

Semantic usage:
- 4–8: icon/text gaps
- 10–12: compact controls
- 16: default card/control padding
- 20–24: section spacing
- 28–32: major card padding/page rhythm
- 40–64: desktop section separation
- 80–96: hero/large-shell spacing

## 4. Radius scale

6, 8, 10, 12, 14, 16, 18, 22, 28, 32, 9999

Semantic usage:
- 6–10: fields, compact chips
- 12–16: buttons, rows, icons
- 18–22: cards
- 28–32: sheets, hero containers, large shells
- 9999: pills/circular controls

## 5. Elevation/shadows

- E0: none
- E1: 0 1px 2px rgba(0,0,0,.12)
- E2: 0 6px 18px rgba(0,0,0,.18)
- E3: 0 12px 30px rgba(0,0,0,.24)
- E4: 0 20px 50px rgba(0,0,0,.32)
- E5: 0 30px 80px rgba(0,0,0,.38)
- Glow mint: 0 0 0 1px rgba(84,219,194,.18), 0 10px 30px rgba(84,219,194,.16)
- Focus: 0 0 0 3px rgba(84,219,194,.22)

## 6. Glass recipes

### Functional dark glass
background: rgba(16,40,48,.72)
backdrop-filter: blur(24px) saturate(1.2)
border: 1px solid rgba(125,232,213,.14)
box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 12px 30px rgba(0,0,0,.22)

Use for navigation bars, floating toolbars, popovers and transient controls.

### Functional light glass
background: rgba(255,255,255,.76)
backdrop-filter: blur(24px) saturate(1.15)
border: 1px solid rgba(8,125,115,.12)
box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 12px 30px rgba(32,73,66,.12)

### Clear glass
background: rgba(255,255,255,.12)
backdrop-filter: blur(18px) saturate(1.3)
Only use over visually rich backgrounds where underlying content remains legible.

### No-glass rule
Do not use glass as the default treatment for balances, investment amounts, financial history, transaction proof/forms, dense tables or long text.

## 7. Typography

Primary family remains the existing system/UI stack.
- Display: 30–42 px, weight 750–850, tracking -0.04em
- H1: 26–32 px, weight 750–850, tracking -0.045em
- H2: 17–20 px, weight 700–800
- Body: 13–15 px, line-height 1.5–1.6
- Caption: 10–12 px
- Financial mono: existing mono stack for references and amounts where useful

## 8. Component states

Every interactive component defines Rest, Hover, Pressed, Focus-visible, Selected/active, Disabled, Loading, Success and Error.

Primary button:
- rest: #54DBC2 / dark text
- hover: #69E2C5
- pressed: scale(.985)
- focus: focus shadow
- disabled: 45% opacity
- loading: preserve width and replace label with progress indicator

Secondary button:
- rest: #153C42 with #9BE8D8 text
- selected: mint border/background tint

Destructive:
- text #EE9893
- surface #452A31
- never use red as a decorative accent

## 9. Motion system

Motion is purposeful and interruptible.

Durations:
- Micro: 100–160 ms
- Standard: 180–260 ms
- Navigation: 300–450 ms
- Sheet enter/exit: 360–520 ms
- Long ambient gradient: 8–15 s

Easing:
- Standard: cubic-bezier(.2,.8,.2,1)
- Exit: cubic-bezier(.4,0,1,1)
- Enter: cubic-bezier(0,0,.2,1)

Spring presets:
- Snappy: stiffness 520, damping 34, mass 0.8
- Standard: stiffness 360, damping 30, mass 0.9
- Soft: stiffness 220, damping 28, mass 1
- Sheet: stiffness 300, damping 32, mass 1

Transition rules:
- Home → detail: shared-element expansion
- Home → Team: directional navigation
- Home → Wallet/Fund: sheet presentation
- Notifications → detail: morph/expand
- Profile → settings: standard navigation
- Confirmation: scale + opacity + spring
- Never animate financial values in a way that obscures the actual number.

## 10. Gesture model

Standard gestures only:
- Tap: activate
- Swipe: dismiss sheets / move between contextual views
- Drag: sheet movement where supported
- Long press: only for contextual actions with a visible alternative
- Pull-to-refresh: only on screens that explicitly support it

Never make a critical action gesture-only.

## 11. Responsive breakpoints

| Range | Mode | Navigation |
|---|---|---|
| 0–479 | Compact | floating bottom tab bar |
| 480–767 | Regular phone | floating bottom tab bar |
| 768–1023 | Medium/tablet | bottom bar, wider content grid |
| 1024–1279 | Expanded | glass left sidebar + top toolbar |
| 1280+ | Wide desktop | 240 px sidebar + centered content workspace |

At expanded/wide widths:
- sidebar is persistent
- top toolbar contains page title, search/context actions
- primary content max width: 860 px
- secondary rail may use remaining space
- bottom tab bar is removed

## 12. Navigation behavior

### Phone
Home, Wallet, Lucky Wish, Invest, Team and Me remain the six top-level destinations.

The bottom navigation stays visible during section navigation, floats over content with safe-area padding, uses glass only as the functional navigation layer, and reserves enough bottom padding to avoid obstruction.

### Tablet
Keep the same six destinations and bottom navigation while space remains below 1024 px. Increase content width and use multi-column sections where useful.

### Desktop
Convert the same six destinations into a persistent 240 px sidebar. Do not create a second information architecture.

## 13. Sheets, dialogs and popovers

- Sheets: 28–32 px top radius, drag handle, safe-area bottom padding
- Dialogs: max 480 px width, 22–28 px radius
- Popovers: 14–18 px radius, E2–E3
- Transient surfaces must support focus management and Escape dismissal where applicable.

## 14. Page-by-page adoption map

### Phase 1 — foundation
Global shell, tokens, typography, buttons, focus states, glass navigation, responsive breakpoints and reduced-motion rules.

### Phase 2 — primary user shell
Home, Wallet, navigation, notification panel, toast/popup surfaces.

### Phase 3 — investment experience
Invest list, investment detail sheet, category/filter controls, maturity countdown presentation, shared-element card/detail transition.

### Phase 4 — community/rewards
Team, Lucky Wish, winner cards, community page, reward/celebration motion.

### Phase 5 — account/auth
Me, Sign in, Sign up, password recovery, security states.

### Phase 6 — administration
Admin shell, control center, search/editor sheets, tables/queues, audit views and responsive desktop sidebar.

### Phase 7 — polish
Accessibility, reduced-motion, keyboard/focus, performance, visual regression and production verification.

## 15. Financial safety boundary

The design system must not modify Supabase financial RPC signatures, wallet balances, investment creation/maturity logic, deposit approval logic, withdrawal processing, referral qualification/accounting, Lucky Wish entry deductions/winner accounting, ledger entries, audit logs or financial database schemas.

Allowed changes are visual structure, interaction presentation, accessibility, responsive layout and non-financial client-side animation.
