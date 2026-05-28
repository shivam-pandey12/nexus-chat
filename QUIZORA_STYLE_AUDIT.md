# Quizora Style Audit For Nexus Chat

Source audited: `C:\Users\shiva\OneDrive\quizora_next`

Scope: styling only. This audit does not copy Quizora quiz logic, data models, routes, or product features.

## 1. Color System

Quizora uses a compact HSL variable system exposed to Tailwind:

- Light background: warm ivory, `hsl(42 64% 96%)`.
- Dark background: near-black blue, `hsl(224 30% 8%)`.
- Foreground: soft charcoal in light mode, muted ivory in dark mode.
- Surfaces: `surface` white and `surface-strong` warm ivory in light mode; deep blue-black panels in dark mode.
- Borders: warm beige in light mode, muted blue-gray in dark mode.
- Primary accent: champagne/gold, `hsl(39 61% 47%)` in light and brighter gold in dark.
- Secondary highlight: restrained blue, used mostly for focus rings and ambient glow.
- Status colors: success, warning, danger are semantic and restrained.

Visual pattern:

- Body uses two soft radial ambient glows plus a flat ivory/dark base.
- Cards use translucent white/surface panels with `border-border`, not heavy outlines.
- Gradients are calm: ivory to amber to soft sky, never neon.
- Dark mode keeps the same layout language but switches to glassy dark surfaces.

## 2. Typography

- Body font: Inter/system sans.
- Headings: Georgia/serif, semibold, balanced line wrapping.
- Heading style is large but not overly condensed.
- Eyebrows: small uppercase semibold, primary color.
- Body copy: `text-base`, `leading-7`, muted color.
- Buttons: rounded-full, semibold, compact line height.
- Labels: small semibold, readable, not heavily letter-spaced.

Quizora feels cleaner because it avoids extreme font weights and oversized letter spacing. It uses confident semibold type and lets spacing/card layout carry the premium feel.

## 3. Layout System

- Main container: `.container-page` with `max-w-7xl`, `px-4 sm:px-6 lg:px-8`.
- Header: sticky, full-width strip connected to page boundaries, border-bottom, blurred background.
- Footer: full-width connected strip, border-top, simple grid.
- Sections: `py-10 sm:py-14`, then constrained inner content.
- Cards: `rounded-3xl`, `p-5`, `gap-4`, responsive grids.
- Dashboards: dense but calm cards, usually 2-3 columns desktop and single column mobile.
- Mobile: collapses nav into a full glass panel under header; cards stack with generous tap targets.

## 4. Components

- Buttons: simple variants: primary, secondary, ghost, danger. Rounded-full, min-height 40-48px, hover lift.
- Cards: one `Card` primitive: `glass-panel rounded-3xl transition duration-300`.
- Badges: rounded-full, border, surface background, small semibold text.
- Inputs: height 48px, rounded-2xl, border, surface background, focus ring.
- Section headers: separate reusable component with eyebrow, title, description.
- Page headers: grid background, constrained text, optional actions.
- Stat cards: card primitive plus icon square, value, helper text.
- Dialogs: confirmation dialogs are card-based, not browser-default prompts.
- Navbar: clean top strip, centered nav, dropdown cards with icon tiles and short descriptions.
- Footer: no floating bubble styling; it is connected to page boundaries.

## 5. Visual Effects

- Shadows: `shadow-premium` and `shadow-glow`, soft and warm.
- Border radius: 1rem to 1.6rem, commonly `rounded-3xl`.
- Glass: translucent but restrained; not every element is heavily blurred.
- Hover: small translate lift, subtle border/primary tint.
- Focus: visible blue outline/ring.
- Animation: slow orbit/float/shimmer and dropdown bloom; motion is purposeful and reduced-motion safe.
- Grid texture: subtle premium grid via `premium-grid`, usually masked/faded.

## 6. UI Quality Rules / Design DNA

What makes Quizora clean:

- One small design vocabulary repeated everywhere.
- Connected header/footer instead of floating islands.
- Warm ivory base with restrained gold and blue.
- Cards feel premium because of spacing, radius, border, and shadow consistency.
- Typography is calmer: serif headings, semibold UI text, less exaggerated tracking.
- Buttons and chips are compact, consistent, and tactile.
- Empty and admin states are still designed as cards, not raw tables.

Patterns to reuse in Nexus Chat:

- CSS variable palette: warm ivory, gold primary, blue focus, dark midnight surfaces.
- Connected page header/footer treatment.
- `container-page` max width and section spacing.
- `glass-panel`, card, badge, button, input, stat-card primitives.
- Page header grid texture and card-based dashboard sections.
- Clean dropdown/modal cards.
- Header profile pill style and rounded action buttons.

What not to copy:

- Quizora quiz routes, quiz cards as content, scoring, XP, leaderboard logic, classroom flows, or quiz-specific labels.
- Orbiting quiz hero content literally. Nexus needs room/chat previews instead.
- Any quiz-specific business copy.

