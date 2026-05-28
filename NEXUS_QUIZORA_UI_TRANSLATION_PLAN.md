# Nexus Chat Quizora UI Translation Plan

Goal: adapt Quizora's visual design language into Nexus Chat while preserving Nexus Chat's real-time room/chat product behavior.

## Design Translation

- Quizora variable palette -> Nexus CSS variables:
  - Warm ivory app background.
  - Gold primary accent.
  - Soft blue focus/highlight.
  - Midnight dark mode.
  - Muted beige borders.

- Quizora connected navbar/footer -> Nexus header/footer:
  - Keep Nexus side-panel navigation pattern.
  - Header remains a connected strip with brand, immediate shortcuts, profile, notifications, theme.
  - Footer/legal surfaces use connected page sections, not floating rounded islands.

- Quizora `Card` primitive -> Nexus repeated surfaces:
  - Room cards, community cards, event cards, pricing cards, store cards, admin cards, profile cards.
  - Unified radius, shadow, border, hover lift.

- Quizora buttons -> Nexus CTAs/actions:
  - Primary gold filled buttons.
  - Secondary outlined surface buttons.
  - Ghost buttons for low-priority actions.
  - Danger buttons for destructive actions and confirmation cards.

- Quizora badges/chips -> Nexus category/status/role pills:
  - Rounded-full, small semibold, border, surface background.
  - Category color remains subtle and derived from Nexus category config.

- Quizora page headers -> Nexus landing/explore/profile/admin/legal:
  - Eyebrow, large serif heading, muted description, action area.
  - Soft grid/ambient background.

- Quizora dashboard cards -> Nexus dashboard-like pages:
  - My Rooms, Profile, Billing, Admin, Communities, Analytics Lite.
  - Stat cards use icon shell, value, helper text.

- Quizora modal/dialog patterns -> Nexus modals/drawers:
  - Report, feedback, confirmation, mini profile, room drawer panels.
  - Rounded-3xl cards, clear heading, calm backdrop blur.

## Chat-Specific Translation

Quizora has no direct chat equivalent, so Nexus chat adapts the same design DNA:

- Chat header:
  - Page-header quality, strong title, compact status/category pills.
  - Connected inside chat panel, not bulky.

- Message well:
  - Soft grid texture like Quizora page headers.
  - Own/other bubbles use surface/primary variations.
  - System messages become centered rounded timeline chips.

- Composer:
  - Premium rounded command bar using Quizora input/button language.
  - Sticky bottom, safe-area aware.

- Right drawer:
  - Dashboard-card treatment.
  - Online users are compact cards with avatar, role, status, and contained action menus.

- Category tools:
  - Tool cards become stat/card style panels.
  - No clutter in composer; use drawer/card layout.

## Screen Mapping

- Landing Page:
  - Quizora hero structure -> Nexus room/social hero with live-room preview and CTAs.

- Guest Entry:
  - Quizora auth cards -> Nexus identity card, avatar selector, Google/guest explanation.

- Explore Rooms:
  - Quizora explorer cards -> Nexus room discovery grid and category chips.

- Create Room:
  - Quizora form cards -> Nexus category/template/type cards and room rules preview.

- Active Chat Room:
  - Quizora dashboard/card polish -> premium room workspace with message well and drawer.

- My Rooms:
  - Quizora dashboard cards -> created/joined/favorites/recent shelves.

- Profile / Settings:
  - Quizora profile/dashboard treatment -> profile hero, settings cards, inputs.

- Notifications:
  - Quizora dropdown/card style -> notification cards with category badges and read states.

- Communities / Events:
  - Quizora page header + card grid -> community directory/home/events.

- Pricing / Billing / Store:
  - Quizora pricing/billing cards -> Nexus plan/store/entitlement cards.

- Admin Panel:
  - Quizora admin dashboard cards -> Nexus operations dashboard, metrics, reports, rooms, communities, billing.

- Legal / Safety / Contact / Updates:
  - Quizora article/card layout -> clean static pages with readable sections.

## Implementation Approach

1. Refine `src/components/ui/premium.js` into a Quizora-inspired Nexus UI kit.
2. Add a final CSS translation layer in `src/styles.css` for shared class names already used by Nexus screens.
3. Preserve all existing callbacks, socket events, Firebase/Razorpay/admin logic, routes, and state.
4. Avoid copying Quizora content or product features.
5. Verify with `npm run build` and `npm run check`.

