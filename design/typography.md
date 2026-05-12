# CivicSim Typography

## Fonts

| Role       | Font                 | Fallback                                |
|------------|----------------------|-----------------------------------------|
| Body / UI  | **Inter**            | Helvetica Neue, Arial, sans-serif       |
| Numbers    | **JetBrains Mono**   | SF Mono, Menlo, Courier New, monospace  |

> For presentations without Inter installed: use **Helvetica Neue** (Mac) or **Calibri** (Windows). For monospace numbers use **Courier New** or **Roboto Mono**.

---

## Type Scale

### Hero title
- Size: `80px` on desktop (clamp 40–80px)
- Weight: **700**
- Tracking: `-0.035em` (very tight)
- Line height: `1.05`

### Section heading
- Size: `40px` on desktop (clamp 28–40px)
- Weight: **700**
- Tracking: `-0.025em`
- Line height: `1.15`

### Study sub-heading (h3)
- Size: `32px` on desktop (clamp 24–32px)
- Weight: **700**
- Tracking: `-0.022em`

### Body copy
- Size: `16px`
- Weight: `400`
- Line height: `1.7`

### Small body / card text
- Size: `15px`
- Weight: `400`
- Line height: `1.6`

### Mono label / eyebrow
- Font: **JetBrains Mono**
- Size: `11.5px`
- Weight: **600**
- Tracking: `+0.12em`
- Case: UPPERCASE

### Stat number
- Font: **JetBrains Mono**
- Size: `56px` (big stat) / `38px` (card stat)
- Weight: **600**
- Tracking: `-0.03em`

---

## Slide Sizes (Standard)

| Context             | Heading    | Sub      | Body   | Caption |
|---------------------|-----------|----------|--------|---------|
| Title slide         | 60–72pt   | 28–32pt  | —      | —       |
| Content slide       | 36–44pt   | 22–26pt  | 18pt   | 13pt    |
| Stat / callout card | 64–80pt   | 16–18pt  | —      | 12pt    |
| Footnote / source   | —         | —        | —      | 10pt    |

---

## Hierarchy Pattern

```
MONO EYEBROW (UPPERCASE, TRACKED) — e.g. "01  OVERVIEW"
Heading in Inter Bold
Body text in Inter Regular, line-height 1.7
  → Mono numbers for data points
```
