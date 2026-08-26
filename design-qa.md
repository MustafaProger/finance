# Archived Design QA — накопления

- Source visual truth: `/var/folders/1b/w5cbgmqx2q37n6c87lcdxj380000gn/T/TemporaryItems/NSIRD_screencaptureui_aBVx11/Снимок экрана — 2026-07-22 в 14.03.27.png`
- Implementation screenshot: `/tmp/finance-savings-adjustment.png`
- Combined comparison: `/tmp/finance-savings-comparison.jpg`
- Viewport: 1920 × 1280 CSS px, desktop dark theme
- Source pixels: 2940 × 1912; normalized to 1920 × 1280 for comparison
- Implementation pixels: 1920 × 1280 at DPR 1
- State: «Сбережения» → «Изменить сумму» → «Пополнить»

## Full-view comparison evidence

The page hierarchy, dark palette, modal placement, segmented control, amount field,
typography, radii, and primary action preserve the supplied design. The modal is
intentionally taller because the requested account selector is now part of the
core transfer flow.

## Focused region comparison evidence

The modal was inspected at full desktop resolution. The account rows use the
existing account colors and icon system, show current balances, expose a clear
selected state, and remain within the modal without clipping. The savings card
now uses the existing bank icon instead of the removed pig icon.

## Required fidelity surfaces

- Fonts and typography: unchanged existing application typography and hierarchy.
- Spacing and layout rhythm: existing modal spacing retained; new account rows use
  the same spacing and radius language as the account picker elsewhere in the app.
- Colors and visual tokens: existing blue active state, surface, border, muted text,
  and account color tokens reused.
- Image and icon fidelity: no raster assets were required; existing Lucide bank,
  wallet, card, arrow, and check icons are used consistently.
- Copy and content: labels clearly distinguish source account for deposits and
  destination account for withdrawals.

## Interaction and runtime evidence

- Page identity: `http://127.0.0.1:4173/#savings`, title «Капитал — личные финансы».
- Primary interaction: opened «Изменить сумму», entered an amount, switched from
  «Пополнить» to «Снять», and verified the account-direction label changes.
- Validation: a withdrawal above the saved balance disables submission; a valid
  amount enables it.
- Console: no warnings or errors.
- Mobile DOM check: at 390 × 844 CSS px the modal becomes a full-width bottom sheet
  and all controls remain present. The in-app browser returned a cropped mobile
  raster, so desktop visual evidence is the authoritative screenshot.

## Findings

No actionable P0, P1, or P2 visual or interaction issues remain. The additional
account rows are an intentional product change required by the brief rather than
design drift.

## Comparison history

- Initial implementation: the withdrawal action remained enabled when the entered
  amount exceeded the savings balance.
- Fix: submission now requires a positive amount no greater than the available
  savings balance in withdrawal mode.
- Post-fix evidence: 1000 ₽ against a 999 ₽ balance is disabled; 500 ₽ is enabled.

## Follow-up polish

No blocking follow-up polish identified.

archived result: passed

---

# Design QA — закреплённая месячная сводка операций

- Source visual truth:
  - `/var/folders/1b/w5cbgmqx2q37n6c87lcdxj380000gn/T/codex-clipboard-a0935625-cc21-4f4c-bc87-de36c64b3812.png`
  - `/var/folders/1b/w5cbgmqx2q37n6c87lcdxj380000gn/T/codex-clipboard-82f03dfd-64ca-41dc-ab43-96f167f6df81.png`
  - `/var/folders/1b/w5cbgmqx2q37n6c87lcdxj380000gn/T/codex-clipboard-51f7bf1f-c808-4e8d-82ce-9d51847f3400.png`
- Implementation screenshots:
  - `/tmp/finance-sticky-month-july-desktop.png`
  - `/tmp/finance-sticky-month-june-desktop.png`
  - `/tmp/finance-sticky-month-august-mobile-postfix.png`
  - `/tmp/finance-sticky-month-july-mobile.png`
  - `/tmp/finance-sticky-month-june-mobile.png`
- Combined comparisons:
  - `/tmp/finance-sticky-month-full-comparison.png`
  - `/tmp/finance-sticky-month-focused-comparison.png`
- Viewports: 1280 × 720 CSS px desktop and 390 × 844 CSS px mobile, dark theme.
- Source pixels: 1260 × 2736 for each reference; normalized to 390 × 844 for the full mobile comparison.
- Implementation pixels: 1280 × 720 desktop and 390 × 844 mobile at DPR 1.
- State: «Операции», empty date range, scrolling from August 2026 through July 2026 to June 2026.

## Full-view comparison evidence

The reference keeps a compact month, expense, and income summary visible above the
transaction history while the visible month changes. The implementation preserves
that hierarchy inside the existing «Капитал» design system: the summary remains at
12 px from the desktop viewport top and 8 px from the mobile viewport top, with the
existing navigation, surfaces, category glyphs, and transaction density retained.

The reference's banking navigation, merchant logos, filter chips, and progress bars
were not copied because the requested target is the scroll-linked monthly summary,
not a replacement of the application's established navigation or operation rows.

## Focused region comparison evidence

The focused comparison checks the June state. Both versions put the month first and
then show «Потратили» and «Получили» with red and green semantic colors. The desktop
implementation uses one compact row; mobile intentionally reflows to a month row
plus two equal metrics so full monetary values remain readable at 390 px.

## Required fidelity surfaces

- Fonts and typography: existing application font stack, weight hierarchy, and
  numeric emphasis are preserved; labels remain secondary and amounts stay legible.
- Spacing and layout rhythm: 9–12 px internal spacing, 14–19 px radii, and compact
  desktop/mobile grids match the established application surfaces and the reference
  hierarchy without clipping.
- Colors and visual tokens: the application's surface, border, muted text, red
  expense, green income, and blue accent tokens are reused consistently.
- Image quality and asset fidelity: the requested summary has no required raster
  assets. Existing transaction icons remain unchanged; no placeholder or CSS-drawn
  image asset was introduced.
- Copy and content: month, operation count, «Потратили», and «Получили» are concise
  and dynamically reflect filtered RUB transactions for each month.
- Accessibility: the summary is a semantic header with an accessible monthly label;
  there is no horizontal overflow at either tested viewport.

## Interaction and runtime evidence

- Page identity: `http://localhost:4173/#transactions`, title «Капитал — личные финансы».
- Desktop: August → July at scrollY 1200 → June at scrollY 8200; the active summary
  remained at 12 px from the viewport top.
- Mobile: August → July at scrollY 1592 → June at scrollY 8592; the active summary
  remained at 8 px from the viewport top and above the fixed bottom navigation.
- Monthly values verified: July 67 326 ₽ spent / 67 646 ₽ received; June 34 748 ₽
  spent / 33 245 ₽ received.
- Browser console: no warnings or errors; no framework overlay.
- Responsive layout: no page or summary horizontal overflow at 1280 × 720 or
  390 × 844.

## Findings

No actionable P0, P1, or P2 visual, interaction, responsiveness, accessibility, or
copy issues remain. The implementation intentionally adapts the reference component
to the existing product rather than cloning unrelated banking chrome.

## Comparison history

- Initial comparison finding [P2, copy]: August displayed «4 операций», which made
  the otherwise polished sticky summary read incorrectly.
- Fix: added Russian plural selection for operation counts and reused it in both the
  filter count and monthly summary.
- Post-fix evidence: `/tmp/finance-sticky-month-august-mobile-postfix.png` visibly
  shows «4 операции» while the August summary remains sticky without overflow.

## Follow-up polish

The reference contains category distribution bars. They were intentionally omitted
from this focused implementation to keep the sticky mobile block compact; they can
be added later if monthly category composition becomes part of the requested scope.

final result: passed
