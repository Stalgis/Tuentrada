# Design System: Sector Performance Mobile Suite
**Project ID:** 2809187953780151233

## 1. Visual Theme & Atmosphere
This app follows an editorial mobile analytics language rather than a conventional admin dashboard. The visual tone is calm, premium, and highly legible on a phone. Information is arranged so the most important number becomes the first thing the eye sees, while supporting metrics sit on softly layered surfaces around it. The overall feeling is "clear command without clutter": generous spacing, few labels, almost no decorative chrome, and charts that explain themselves at a glance.

The light mode behaves like a stack of bright vellum sheets with gentle tonal separation. The dark mode behaves like layered graphite with restrained electric-blue highlights and soft off-white typography. In both modes, the design avoids hard lines and dense tables in favor of grouped cards, concise summaries, and visual ranking.

## 2. Color Palette & Roles
- **Editorial Sky Blue (`#0058BC`)**: Primary action color in light mode. Used for hero KPIs, active states, and key chart emphasis.
- **Electric Signal Blue (`#0A84FF`)**: Primary emphasis in dark mode. Used sparingly so the interface keeps its premium restraint.
- **Soft Paper White (`#FFFFFF`)**: Main light-mode card surface. Used for the most important content containers.
- **Cloud Mist (`#F7F9FB`)**: Main light-mode app background. Gives the UI a soft, breathable base.
- **Warm Graphite (`#201F1F`)**: Main dark-mode card surface. Used for interactive cards and grouped content.
- **Deep Charcoal (`#131313`)**: Main dark-mode background. Avoids pure black so the UI feels richer and less harsh.
- **Quiet Slate (`#414755`)**: Secondary light-mode text tone. Used for metadata, labels, and helper information.
- **Muted Blue Grey (`#C0C6D6`)**: Secondary dark-mode text tone. Used for labels and low-priority copy.
- **Signal Green (`#37B26C`)**: Positive delta, progress, and health indicators.
- **Warm Amber (`#F2A640`)**: Warnings, featured highlights, and selective category emphasis.
- **Soft Rose (`#E56B6F`)**: Error or urgent attention state, used only when needed.

## 3. Typography Rules
The design language is driven by strong numerical hierarchy. Headlines and large values should feel architectural, with tight spacing and confident weight. Supporting copy should remain compact, quiet, and easy to scan. Large KPI values should always dominate their labels. Labels should be brief, uppercase only when they benefit recognition, and visually softer than the values they describe.

Typography must support fast scanning on mobile:
- Hero metrics: large, bold, compact line-height
- Section titles: medium-large, confident, short
- Labels and metadata: small, subdued, concise
- Long paragraphs: avoided whenever possible

## 4. Component Stylings
* **Buttons:** Pill-shaped or generously rounded. Primary buttons use the system accent color with strong contrast. Secondary buttons rely on tonal fill instead of hard outlines.
* **Cards/Containers:** Large, heavily rounded corners with tonal separation instead of visible borders. The card stack should feel layered rather than boxed.
* **Inputs/Forms:** Soft-filled fields with quiet backgrounds. Focus should be visible through color and emphasis, not heavy outlines.
* **Charts:** Minimal labels, clear emphasis, and immediate readability. Charts should explain trend, ranking, or progress in a single glance.
* **Progress Indicators:** Rings and bars use the accent color only where emphasis matters. Tracks should stay subdued and structural.
* **Lists:** Event and activity rows prioritize thumbnail, status, short metadata, and one key value. Long text blocks are avoided.

## 5. Layout Principles
The app is designed exclusively for phone screens. It should always read as a sequence of purposeful cards in a single-column mobile rhythm. The screen edge margins must remain generous enough to avoid visual crowding. Vertical spacing is a core part of the design language and should separate groups more than borders do.

Core layout rules:
- Single-column mobile flow
- Hero content first
- Supporting metrics grouped in compact cards
- Short sections with clear titles
- Minimal text, strong visual comparison
- Light and dark mode parity across every major screen
