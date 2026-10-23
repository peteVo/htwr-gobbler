---
name: Gobbler
description: A calm academic reading desk for finding the next coursework action and its evidence.
colors:
  paper: "#f6f4ef"
  surface: "#fffefa"
  sidebar: "#182f43"
  ink: "#243849"
  muted: "#586978"
  line: "#d7dddf"
  accent: "#285a7c"
  accent-hover: "#1d4562"
  accent-ink: "#ffffff"
  soft: "#e8eff3"
  gold: "#f5ecd4"
  gold-ink: "#70571e"
  clay: "#f5e6df"
  clay-ink: "#8a4933"
  blue: "#e3edf5"
  blue-ink: "#315b79"
  danger: "#993e34"
  danger-bg: "#f9e6e0"
  focus: "#9a6027"
  dark-paper: "#142330"
  dark-surface: "#1c2e3d"
  dark-sidebar: "#0d1d2a"
  dark-ink: "#edf1f2"
  dark-muted: "#b8c6d1"
  dark-line: "#3f5363"
  dark-accent: "#b8d9ef"
  dark-accent-hover: "#d4e9f7"
  dark-accent-ink: "#163047"
  dark-soft: "#2a4356"
  dark-gold: "#443a27"
  dark-gold-ink: "#f0d69e"
  dark-clay: "#49332f"
  dark-clay-ink: "#f1b9a6"
  dark-blue: "#233e55"
  dark-blue-ink: "#c2deef"
  dark-danger: "#ffbaa9"
  dark-danger-bg: "#482e2c"
  dark-focus: "#f4bc60"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(2.25rem, 3.5vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  xs: "3px"
  sm: "5px"
  md: "8px"
  lg: "12px"
spacing:
  unit: "8px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
    height: "46px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
---

# Design System: Gobbler

## Overview

**Creative North Star: “The Academic Reading Desk”**

Gobbler gives coursework a calm, practical place to be read and acted on. A deep navy rail anchors a warm paper workspace; clear headings, generous body text and visible source evidence keep attention on the next useful action. Its academic character comes from disciplined typography and quiet surfaces, not decorative school imagery.

The same reading discipline carries through Today, tasks, calendar, courses, sources, assistant and settings. The existing Gobbler mark remains the identity anchor. The interface supports light, dark and system themes, localized controls, keyboard use and reduced motion.

**Key Characteristics:**
- Warm paper work surfaces framed by a deep navy navigation rail.
- Readable, spacious working text with serif page titles.
- Source and review states stay explicit and readable.

## Colors

A restrained navy and blue structure sits over warm paper; amber, clay and blue tints distinguish meaningful review and category states. Dark mode uses its own resolved values rather than simply inverting the light palette.

### Primary
- **Working blue:** `{colors.accent}` drives primary actions, links and active emphasis; hover deepens it in light mode.
- **Deep navy rail:** `{colors.sidebar}` anchors desktop navigation and the brand area.

### Neutral
- **Warm paper:** `{colors.paper}` is the page ground; `{colors.surface}` distinguishes working surfaces such as cards and fields.
- **Ink and muted ink:** `{colors.ink}` carries primary reading text; `{colors.muted}` carries supporting text and metadata.
- **Quiet divider:** `{colors.line}` separates rows, panels and calendar cells.
- **Review amber:** `{colors.gold}` with `{colors.gold-ink}` marks dates or evidence that still needs review.
- **Clay and pale blue:** `{colors.clay}` / `{colors.clay-ink}` and `{colors.blue}` / `{colors.blue-ink}` distinguish category states.
- **Danger:** `{colors.danger-bg}` and `{colors.danger}` mark errors.

Dark-mode equivalents are the `dark-*` tokens in frontmatter. Preserve the same semantic roles and keep state words alongside color.

## Typography

**Display Font:** Source Serif 4 (Georgia, serif)
**Body Font:** Source Sans 3 (system-ui, sans-serif)
**Label/Mono Font:** Source Sans 3; tabular numerals are used for dates and times.

**Character:** The serif page title adds a quiet editorial note; Source Sans 3 keeps dense academic information plain and quick to scan. Both families are self-hosted with EN/DE/VI subsets.

### Hierarchy
- **Display** (500, clamp(2.25rem, 3.5vw, 3rem), 1.1): page-level titles.
- **Headline** (600, 1.375rem, 1.6): section headings.
- **Title** (600, 1.125rem, 1.4): task names and subordinate headings.
- **Body** (400, 1.0625rem, 1.6): primary working text; controls inherit a 1rem size.
- **Label** (600, 1rem, 1.5): form labels and prominent control text. Supporting text uses 0.875rem (14px).

**The Readable-First Rule.** Keep ordinary copy at 17px, controls at 16px and supporting copy at 14px or larger.

## Layout

The fixed navigation rail is 236px wide at wide desktop and 216px below 1150px. The sticky top bar is 80px tall on desktop and 72px on narrow screens. Main content is capped at 1440px, with 40px side padding (58px from 1500px); it reduces to 25px below 1150px and 18px on mobile. The Today grid gives assignments the wider column beside schedule and source coverage.

At 1150px, the assistant stacks its question and material library. At 900px, the dashboard and settings become one column, and the calendar week grid becomes a single column; compact week cells use a 60px minimum height. At 800px, the rail becomes a labeled menu and workspace content follows a single-column flow. At 320px, preserve wrapping and allow controls to fit without horizontal page overflow. Use the 8px spacing unit and the existing generous 28–36px section gaps.

**The Next-Action Rule.** Keep the next assignment and its date/source easy to find before secondary setup or aggregate information.

## Elevation & Depth

Depth comes primarily from paper-to-surface contrast, borders and the anchored rail. A restrained shadow separates the open mobile navigation overlay and lifts modal dialogs above the workspace; the calendar’s today cell uses a surface shift. Ordinary resting course cards remain flat.

## Shapes

Controls and fields use softly rounded 8px corners; cards use 12px corners. Small verification labels use a compact 3px radius, and course monograms use 6px. Dividers stay thin and quiet. Focus is a clearly visible 2px outline with a 4px offset; maintain a 44px minimum interactive target where provided, even when an icon’s visible glyph is smaller.

## Components

Controls are familiar, direct and sized for reading and touch. Hover states shift surface or accent color; focus remains visible in both themes.

### Buttons
Primary buttons use the working blue fill, contrasting text, 11px by 18px padding and a 46px minimum height. Secondary buttons use a surface fill and divider border. Both use 8px corners and 16px semibold text. Text buttons remain low chrome with a 44px minimum height. Icon buttons also provide a 44px target.

### Chips
Verification labels use a soft blue background and accent text; review state switches to amber with its corresponding dark text. Status always remains understandable from its words.

### Cards / Containers
Course cards use the clean surface, a quiet border, 12px corners and 26px internal padding. Assistant quotations sit on the paper ground with 8px corners and generous padding. Rows often remain border-separated rather than boxed.

### Inputs / Fields
Inputs, selects and textareas use a clean surface, 1px muted stroke, 8px corners, 11px by 13px padding and 16px text. Focus uses the shared contrasting outline. Labels are semibold with an 8px gap to their field.

### Navigation
The desktop rail uses the deep navy surface, light text and muted links. Active items use a pale background and dark ink; hover uses the rail’s muted tint. Each row is at least 48px high. On mobile, use the labeled menu and keep its close control at 44px.

## Do's and Don'ts

### Do:
- **Do** keep source provenance and review state visible beside the coursework they qualify.
- **Do** use the supplied light/dark semantic tokens so status contrast survives each theme.
- **Do** retain generous line-height and wrapping for long course names, questions and dates.

### Don't:
- **Don't** reduce supporting text below 14px or controls below 16px.
- **Don't** communicate verification or errors through color alone.
- **Don't** replace the reading desk with decorative mockups or promotional artwork.
