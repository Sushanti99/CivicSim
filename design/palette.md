# CivicSim Color Palette

Copy hex codes directly into Figma, PowerPoint, Keynote, or Google Slides.

---

## Primary Brand

| Name       | Light mode    | Dark mode     | Use                          |
|------------|---------------|---------------|------------------------------|
| Cyan       | `#1D4ED8`     | `#00D4FF`     | CTAs, links, numbers, glows  |
| Violet     | `#2563EB`     | `#A855F7`     | Behavioral stream, accents   |
| Green      | `#10B981`     | `#10B981`     | Checkmarks, "not needed" tag |
| Amber      | `#F59E0B`     | `#F59E0B`     | "Optional" tag, warnings     |
| Red        | `#EF4444`     | `#EF4444`     | "Required" tag, crosses      |

---

## Backgrounds

| Name           | Light         | Dark          |
|----------------|---------------|---------------|
| Page bg        | `#F6F9FF`     | `#070A14`     |
| Page alt       | `#EEF5FF`     | `#0A0E1C`     |
| Card surface   | `#FFFFFF`     | `#0F1421`     |
| Card surface 2 | `#EAF2FF`     | `#151B2D`     |

---

## Text

| Name    | Light         | Dark          |
|---------|---------------|---------------|
| Primary | `#0B1F4D`     | `#E8EAF0`     |
| Dim     | `#486381`     | `#A0A8BD`     |
| Faint   | `#7B8EA8`     | `#6B7390`     |

---

## UI Components

| Name                | Hex           | Notes                        |
|---------------------|---------------|------------------------------|
| Policy Blue card    | `#2563EB`     | Pre-Proposal icon bg         |
| Policy Violet card  | `#7C3AED`     | Message Testing icon bg      |
| Policy Green card   | `#059669`     | Coalition Building icon bg   |
| Trust banner from   | `#1E3A8A`     | Dark blue gradient start     |
| Trust banner to     | `#2563EB`     | Blue gradient end            |

---

## Gradients (CSS)

```css
/* CTA button */
background: linear-gradient(135deg, #1D4ED8 0%, #2EE0FF 100%);

/* Stat number text */
background: linear-gradient(135deg, #1D4ED8, #2563EB);

/* Trust / hero dark banner */
background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);

/* Page hero background */
background:
  radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.12), transparent 30rem),
  radial-gradient(circle at 86% 8%, rgba(14, 165, 233, 0.10), transparent 34rem),
  linear-gradient(180deg, #F6F9FF 0%, #EEF5FF 100%);
```

---

## Presentation Slides (Quick Reference)

| Role            | Hex       |
|-----------------|-----------|
| Slide bg        | `#F6F9FF` |
| Heading text    | `#0B1F4D` |
| Subheading      | `#486381` |
| Accent / CTA    | `#2563EB` |
| Accent 2        | `#A855F7` |
| Stat number     | `#1D4ED8` |
| Highlight green | `#10B981` |
