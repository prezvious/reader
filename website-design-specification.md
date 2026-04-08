# Website Design Specification Guide
## Combining Medium's Layout · Notion's Editor · Apple's Buttons · Claude AI's Aesthetic

*A comprehensive design system blueprint with latest specifications (2025–2026)*

---

## 1. Design Philosophy Overview

This specification fuses four best-in-class design paradigms into a single cohesive system:

**Medium** — the gold standard of digital reading experience, optimizing every pixel for long-form content consumption. **Notion** — the pioneer of block-based editing that treats every piece of content as a modular, draggable, nestable unit. **Apple (Liquid Glass)** — the 2025 WWDC revolution that introduced translucent, depth-aware, capsule-shaped interactive elements across the entire ecosystem. **Claude AI** — Anthropic's warm, human-centered interface that rejects cold, clinical AI aesthetics in favor of terracotta warmth, serif typography, and cream-toned surfaces that feel like a conversation rather than a query engine.

The guiding principle: **intelligence that feels approachable, content that feels effortless, interactions that feel physical, and aesthetics that feel warm.**

---

## 2. Medium-Inspired Content Layout

### 2.1 Core Reading Architecture

Medium's layout philosophy centers on one idea: **the interface should disappear so the content can shine.** Every design decision serves readability.

**Content Column Width:**
- Maximum content width: **680px** (optimal for reading)
- Characters per line: **50–75 characters** (the ideal range backed by cognitive research; 66 characters is widely regarded as perfect)
- Words per line: **9–13 average**
- This narrow column forces the eye into a natural reading rhythm and prevents fatigue from tracking long horizontal lines

**Page Structure:**
- Single-column layout centered on the page
- No sidebars during reading mode
- Full-width images and media can break out of the content column to 1000–1200px for visual impact
- Generous top margin (80–120px) before the article title begins
- Sticky, minimal navigation that fades or shrinks on scroll

**Vertical Rhythm:**
- Consistent spacing based on a baseline grid (8px unit system)
- Paragraph spacing: 2× the body font size (e.g., 21px body → 42px between paragraphs)
- Section breaks use generous whitespace (64–96px) rather than horizontal rules
- Headings have more space above (1.5–2× paragraph spacing) than below (0.5–1× paragraph spacing) to visually associate headings with their content

### 2.2 Typography System (Medium-Derived)

Medium uses **Charter** (a contemporary slab-serif from Bitstream) for body text, falling back to Georgia and Times New Roman. Headings and UI elements use a sans-serif stack anchored by **Inter** or similar screen-optimized sans.

**Recommended Type Stack for This System:**

| Role | Font | Weight | Size (Desktop) | Size (Mobile) | Line Height |
|------|------|--------|----------------|---------------|-------------|
| Article Title | Custom Serif (Copernicus-style) | 700 | 40–48px | 28–34px | 1.10–1.20 |
| Article Subtitle | Serif | 400 | 22–24px | 18–20px | 1.35–1.45 |
| Body Text | Charter / Serif Stack | 400 | 21px | 18px | 1.58–1.65 |
| Lead Paragraph | Serif | 400 italic | 22–24px | 19–20px | 1.50 |
| H2 Heading | Sans-serif | 700 | 30–34px | 24–26px | 1.20–1.25 |
| H3 Heading | Sans-serif | 600 | 22–26px | 20–22px | 1.30 |
| Captions/Meta | Sans-serif | 400 | 14–15px | 13–14px | 1.40 |
| Code Blocks | Source Code Pro / JetBrains Mono | 400 | 15–16px | 14–15px | 1.55 |

**Best Practices:**
- Body text at 21px is larger than the web average (16px) and significantly improves readability and reduces cognitive load
- Use a modular type scale with a ratio of 1.250 (Major Third) or 1.333 (Perfect Fourth)
- Keep heading hierarchy clear: separate visual styling from HTML semantics (an `h2` can look like an `h3` in certain contexts)
- Letter-spacing: slightly expanded (+0.01em) for uppercase labels; default or slightly tightened (-0.01em to -0.02em) for large headlines
- Never go below 12px for any text element

### 2.3 Content Element Patterns

**Pull Quotes:** Full-width with oversized serif text (1.5–2× body size), thin left border or large opening quotation mark as visual anchor.

**Images:** Default at content width (680px), optional "bleed" to 1000–1200px with a fade-to-edge treatment. Always include captions in smaller, muted sans-serif text below.

**Code Blocks:** Light background (#f7f7f7 in light mode), rounded corners (8px), subtle border, horizontal scroll for overflow. Syntax highlighting with warm-toned color scheme.

**Embedded Content:** Cards with subtle shadow, rounded corners, showing a preview image + title + source. Consistent height and padding.

---

## 3. Notion-Inspired Block-Based Editor

### 3.1 Block Architecture

Notion's revolutionary concept: **every piece of content is a modular block** that can be arranged, nested, and customized. Notion 3.0 (launched September 2025) expanded this further with Tab blocks, Heading 4 support, and autonomous AI Agents.

**Core Block Types to Implement:**

- **Text Block** — The default. Rich text with inline formatting (bold, italic, underline, strikethrough, code, color, highlight, link)
- **Heading Blocks** — H1, H2, H3, H4 (H4 added in 2026 API update) with toggleable expand/collapse
- **To-Do Block** — Checkbox + text, with strikethrough on completion
- **Bulleted/Numbered List** — Nestable with indentation
- **Toggle Block** — Expandable/collapsible content container
- **Quote Block** — Left-bordered text for callouts
- **Divider Block** — Thin horizontal line
- **Callout Block** — Icon + colored background container for important notes
- **Code Block** — Syntax-highlighted with language selector
- **Image/Video/File Block** — Drag-to-upload, resize handles, alignment options
- **Embed Block** — URLs auto-expand to rich previews
- **Table/Database Block** — Inline tables with sortable columns
- **Tab Block** — Content organized into labeled, clickable sections (new in 2025–2026)
- **Column Block** — Side-by-side layout within the content area

### 3.2 Block Interaction Patterns

**Slash Commands:**
- Typing `/` opens a floating command palette with searchable block types
- Categories: Basic, Media, Database, Advanced, Embeds
- Fuzzy search for fast access (typing `/cod` finds "Code Block")
- Recently used blocks appear at the top

**Drag-and-Drop:**
- Every block has a drag handle (⋮⋮ icon) that appears on hover, positioned to the left of the block
- Blocks can be dragged to reorder, nest (indent), or move into columns
- A blue insertion line shows the drop target
- Smooth spring-based animation on reorder (200–300ms ease-out)

**Block Actions Menu:**
- Clicking the drag handle or right-clicking opens a context menu
- Options: Delete, Duplicate, Turn Into (convert block type), Copy Link, Move To, Color/Background
- "Turn Into" is critical — any block can become any other block type seamlessly

**Inline Formatting Toolbar:**
- Appears on text selection as a floating bar above the selection
- Contains: Bold, Italic, Underline, Strikethrough, Code, Link, Color, Highlight, Comment
- Position: centered above selection, with smart edge-detection to avoid clipping off-screen

### 3.3 Editor UX Specifications

**Cursor & Selection:**
- Block-level selection: clicking in the left margin selects the entire block (blue highlight)
- Multi-block selection: Shift+click or drag across multiple blocks
- Selected blocks can be deleted, moved, or converted as a group

**Keyboard Shortcuts:**
- `Enter` — New block below
- `Tab` — Indent (nest block)
- `Shift+Tab` — Outdent
- `Backspace` on empty block — Delete block, move cursor to previous
- `---` + Enter — Insert divider
- `[]` + Space — Insert to-do
- `#` + Space — H1, `##` + Space — H2, etc.
- `/` — Open slash command menu
- `Cmd/Ctrl + Shift + H` — Toggle heading expand/collapse

**Performance Considerations:**
- Virtualize long documents (render only visible blocks + buffer)
- Debounce save operations (300–500ms after last keystroke)
- Use `contenteditable` with a controlled state model (like ProseMirror or TipTap) rather than textarea
- Implement offline editing with sync-on-reconnect (Notion added offline mode in August 2025)

---

## 4. Apple-Inspired Buttons & Interactive Elements

### 4.1 Liquid Glass Design Language (WWDC 2025)

Apple's Liquid Glass, unveiled at WWDC 2025 (June 9, 2025), is the most significant visual redesign since iOS 7 in 2013. It introduces a translucent, dynamic material that reflects and refracts surrounding content in real-time.

**Core Properties of Liquid Glass:**
- **Translucency:** Semi-transparent surfaces that reveal blurred content beneath
- **Lensing:** Real-time light bending that concentrates light (unlike traditional blur that scatters it)
- **Specular Highlights:** Reactive highlights that respond to device motion and user touch
- **Adaptive Color:** The material's color is informed by surrounding content and adapts between light and dark environments
- **Materialization:** Elements appear by gradually modulating light bending, creating organic entrance animations

### 4.2 Button Specifications (Apple-Style)

**Primary Shape: The Capsule**

Apple's 2025 design system favors capsule-shaped buttons (fully rounded ends) for primary actions. The capsule's geometry naturally supports concentricity — shapes nested within shapes that share proportional rounding.

```
Button Sizing:
┌─────────────────────────────────────────────┐
│ Size      │ Height │ Padding H │ Font Size  │
├───────────┼────────┼───────────┼────────────┤
│ X-Small   │ 28px   │ 12px      │ 13px       │
│ Small     │ 32px   │ 16px      │ 14px       │
│ Medium    │ 40px   │ 20px      │ 15px       │
│ Large     │ 48px   │ 24px      │ 16px       │
│ X-Large   │ 56px   │ 32px      │ 17px       │
└─────────────────────────────────────────────┘
```

**Button States:**

- **Default:** Subtle glass effect, content clearly legible. Background uses `backdrop-filter: blur(20px)` with a semi-transparent fill
- **Hover:** Increased brightness, expanded specular highlight area. Scale to 1.02× with a 200ms spring-based ease
- **Pressed/Active:** Scale down to 0.97×, reduced brightness, bounce animation on release. Interactive glass elements should "ripple" on tap
- **Focused:** Warm ring shadow (`0 0 0 3px` using the brand accent color at 40% opacity)
- **Disabled:** Reduced opacity (0.4), no glass effect, no interaction feedback

**CSS Implementation Pattern:**
```css
.button-glass {
  /* Shape */
  border-radius: 999px; /* capsule */
  padding: 12px 24px;
  
  /* Glass effect */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  
  /* Specular highlight simulation */
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.08);
  
  /* Typography */
  font-weight: 500;
  letter-spacing: -0.01em;
  
  /* Transitions */
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.button-glass:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.02);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.12);
}

.button-glass:active {
  transform: scale(0.97);
  transition-duration: 0.1s;
}
```

### 4.3 Other Interactive Elements (Apple-Style)

**Toggle Switches:**
- Capsule track with a circular thumb
- Glass effect on the thumb element
- Spring-based animation on state change (300ms, slight overshoot)
- Track color: muted gray (off) → brand accent (on)

**Sliders:**
- Glass effect on the thumb
- Track with warm rounded-rectangle shape
- Support for tick marks, neutral values, and momentum preservation (new in iOS 26)
- Thumbless "progress bar" variant for passive display

**Segmented Controls:**
- Glass capsule background behind the selected segment
- Selected segment slides smoothly between options with a spring animation
- Each segment is a rounded rectangle within the overall capsule container

**Concentric Corner Strategy:**
- When elements are nested (e.g., a button inside a card), the inner element's border-radius should be smaller than the outer element's, creating a concentric effect
- Formula: `inner-radius = outer-radius - padding-between-them`
- Example: Card with 16px radius and 8px padding → Button inside gets 8px radius

### 4.4 Accessibility Requirements (Apple HIG)

- Minimum contrast ratio: **4.5:1** for text on glass surfaces (after blur is applied)
- Maximum **one primary glass sheet per view** — avoid stacking translucent layers
- Respect `prefers-reduced-transparency`: replace glass with solid color fallback
- Respect `prefers-reduced-motion`: disable specular highlight animations and parallax effects
- Specular highlight animation amplitude should not exceed **6px**
- Provide solid-background fallback for older/lower-power devices
- Ensure all interactive elements have a minimum tap target of **44×44px**

---

## 5. Claude AI-Inspired Clean Aesthetic

### 5.1 The Warm Minimalism Philosophy

Claude's design rejects the cold, clinical aesthetic that dominates AI interfaces. Where competitors use sterile blues and machine-like whites, Claude uses **warm terracotta**, **cream backgrounds**, and **serif typography** that says "thoughtful companion" rather than "powerful tool."

Key principles:
- **Human warmth over technological coldness** — every gray has a yellow-brown undertone; there are no cool blue-grays anywhere
- **Content-first hierarchy** — the interface "downplays itself to let the content shine"
- **Literary reading experience** — generous line heights (1.60 for body), serif headlines, editorial rhythm
- **Organic depth** — warm ring shadows instead of harsh drop shadows; hand-drawn-feeling illustrations instead of 3D renders

### 5.2 Color Palette (Claude-Derived)

**Light Mode:**

| Token Name | Hex | OKLCH | Usage |
|------------|-----|-------|-------|
| Background Primary | `#F5F4ED` | oklch(0.97 0.02 70) | Page background (parchment/cream) |
| Background Secondary | `#F0EEE6` | — | Cards, elevated surfaces |
| Background Tertiary | `#E8E6DC` | — | Borders, dividers |
| Surface White | `#FFFFFF` | — | Input fields, composer area |
| Text Primary | `#1A1A18` | — | Body text, headings |
| Text Secondary | `#5E5D59` | — | Muted text, metadata |
| Text Tertiary | `#87867F` | — | Placeholders, captions |
| Brand Accent | `#C96442` | oklch(0.70 0.14 45) | Primary CTAs, brand moments |
| Brand Accent Alt | `#AE5630` | — | Links, hover states |
| Border Cream | `#F0EEE6` | — | Subtle containment borders |
| Border Warm | `#E8E6DC` | — | Prominent borders, section dividers |
| Ring Warm | `#D1CFC5` | — | Focus rings on interactive elements |

**Dark Mode:**

| Token Name | Hex | Usage |
|------------|-----|-------|
| Background Primary | `#141413` | Page background |
| Background Secondary | `#1F1E1B` | Cards, elevated surfaces |
| Background Tertiary | `#2B2A27` | Input areas |
| Surface Dark | `#30302E` | Borders in dark mode |
| Text Primary | `#EEEEEE` | Body text |
| Text Secondary | `#A0A09A` | Muted text |
| Brand Accent | `#C96442` | Remains consistent |

**Critical Rule:** Every neutral tone must carry a **yellow-brown undertone**. Pure grays (#888, #ccc, etc.) break the warmth. Even the darkest surfaces (#141413, #30302E) carry a barely perceptible warmth.

### 5.3 Typography (Claude-Derived)

Claude uses a **custom Anthropic Serif** typeface (internally `__copernicus`) for headlines and branding, with a serif body stack (`ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`) for reading content.

**Recommended Typography System:**

| Element | Font Family | Weight | Size | Line Height | Letter Spacing |
|---------|-------------|--------|------|-------------|----------------|
| Page Headlines | Custom Serif / Copernicus / Freight Text | 500 | 40–56px | 1.10–1.20 | -0.02em |
| Section Headlines | Custom Serif | 500 | 28–36px | 1.15–1.25 | -0.01em |
| Body Copy | ui-serif, Georgia, Cambria, serif | 400 | 18–21px | 1.58–1.65 | 0 |
| UI Labels | Sans-serif (system) | 500 | 14–15px | 1.40 | 0.01em |
| Button Text | Sans-serif (system) | 500 | 15–16px | 1.0 | 0 |
| Code/Mono | JetBrains Mono / Source Code Pro | 400 | 14–15px | 1.55 | 0 |
| Caption/Meta | Sans-serif | 400 | 13–14px | 1.40 | 0.01em |

**Key Design Decisions:**
- Serif for content headlines, sans-serif for UI — this editorial hierarchy is intentional
- Body line-height of 1.60 creates a "literary reading experience"
- Single weight for headlines (500 medium) — the consistency is deliberate
- Tight headline line-heights (1.10–1.30) create a cadence that feels like reading an essay

### 5.4 Spacing & Layout Tokens

Use an **8px base grid** for all spacing:

```
--space-1: 4px    (0.5×)
--space-2: 8px    (1×)
--space-3: 12px   (1.5×)
--space-4: 16px   (2×)
--space-5: 24px   (3×)
--space-6: 32px   (4×)
--space-7: 48px   (6×)
--space-8: 64px   (8×)
--space-9: 96px   (12×)
--space-10: 128px (16×)
```

**Border Radius Scale:**
```
--radius-sm: 8px     (small chips, tags)
--radius-md: 12px    (cards, inputs)
--radius-lg: 16px    (modals, large containers)
--radius-xl: 24px    (hero sections)
--radius-full: 999px (pills, capsule buttons)
```

Apply generous radius (12–32px) throughout for a soft, approachable feel. Claude's aesthetic avoids sharp corners entirely.

### 5.5 Shadow System

Claude uses **warm ring shadows** rather than traditional drop shadows:

```css
/* Subtle elevation (cards, inputs) */
--shadow-sm: 0 0.25rem 1.25rem rgba(0, 0, 0, 0.035);

/* Medium elevation (dropdowns, popovers) */
--shadow-md: 0 0.5rem 2rem rgba(0, 0, 0, 0.06);

/* High elevation (modals, overlays) */
--shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.08);

/* Interactive ring (focus states, hover) */
--ring-default: 0 0 0 1px var(--ring-warm);
--ring-focus: 0 0 0 3px var(--brand-accent-40);

/* Never use: */
/* Pure black shadows, cool-toned shadows, or heavy box-shadows */
```

---

## 6. Integration: Bringing It All Together

### 6.1 Page Architecture

```
┌─────────────────────────────────────────────────┐
│  NAVIGATION BAR (Glass effect, sticky)          │
│  [Logo]        [Nav Links]        [CTA Button]  │
├─────────────────────────────────────────────────┤
│                                                 │
│            CONTENT AREA (680px max)             │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Article Title (Serif, 40-48px)         │    │
│  │  Subtitle (Serif, 22px, muted)          │    │
│  │  Author · Date · Read time              │    │
│  ├─────────────────────────────────────────┤    │
│  │                                         │    │
│  │  [Block-based content area]             │    │
│  │                                         │    │
│  │  Each paragraph, heading, image,        │    │
│  │  code block, list, embed is a           │    │
│  │  discrete draggable block with          │    │
│  │  hover handle + context menu            │    │
│  │                                         │    │
│  │  Body text in serif at 21px             │    │
│  │  on cream (#F5F4ED) background          │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────┐                           │
│  │ [Capsule Button]  │  ← Apple-style glass     │
│  │  "Publish"        │     with warm tint        │
│  └──────────────────┘                           │
│                                                 │
├─────────────────────────────────────────────────┤
│  FLOATING TOOLBAR (Glass, bottom-anchored)      │
│  [Format] [Insert] [Comment] [More ⋯]          │
└─────────────────────────────────────────────────┘
```

### 6.2 Component Fusion Map

| Component | Medium Influence | Notion Influence | Apple Influence | Claude Influence |
|-----------|-----------------|------------------|-----------------|------------------|
| Reading layout | 680px column, 21px body | — | — | Cream background, serif type |
| Text editor | — | Block-based, slash commands | — | Warm color palette, serif body |
| Buttons | — | — | Capsule shape, glass effect, spring animations | Terracotta accent color, warm shadows |
| Toolbar | Minimal, scroll-aware | Floating inline format bar | Glass material, grouped items | Warm neutrals, ring focus states |
| Navigation | Sticky, fades on scroll | Sidebar with tree structure | Glass nav bar, floating | Serif logo, warm hover states |
| Cards | Clean article previews | Database entries as cards | Concentric corners, glass | Cream fill, warm borders |
| Inputs | — | Contenteditable blocks | Glass container, capsule search | Parchment background, warm ring focus |
| Modals | — | Side-peek panels | Glass overlay, zoom transition | Warm tinted overlay |
| Toggle/Switch | — | Database property toggle | Capsule track, glass thumb, spring anim | Terracotta active state |
| Code blocks | Syntax highlighted, full-width | Inline with language selector | — | Warm syntax theme, cream background |

### 6.3 Responsive Breakpoints

Following 2026 best practices:

```
--breakpoint-mobile:   480px   (phones)
--breakpoint-tablet:   768px   (tablets portrait)
--breakpoint-laptop:   1024px  (tablets landscape, small laptops)
--breakpoint-desktop:  1280px  (standard desktops)
--breakpoint-wide:     1440px  (widescreen)
--breakpoint-ultra:    1920px  (Full HD+)
```

Content container max-width: **680px** for reading, **1200px** for app shell. Use relative units (%, rem, vw) with max-width constraints.

Most common mobile widths in 2026: **360px, 375px, 414px, 430px**. Google continues Mobile-First Indexing — design mobile-first, then scale up.

---

## 7. Design Trends to Incorporate (2025–2026)

### 7.1 Bento Grid Layouts
For feature pages, dashboards, or multi-content sections, use bento grid layouts — modular blocks of varying sizes within a unified grid. This creates visual dynamism without rigidity and works perfectly on all screen sizes.

### 7.2 Micro-Animations
Subtle, purposeful animations that react to user behavior: button bounces on hover, menu slides in, icons spin on click. These make the interface feel alive and premium. Keep them under 300ms for responsive feel.

### 7.3 Variable Fonts
Single font files containing entire ranges of weights and widths. Use CSS `font-variation-settings` for smooth weight transitions on hover/focus. Reduces font loading overhead dramatically.

### 7.4 Expressive Typography
Large, bold headlines (2–3× body size minimum) as hero design elements. Typography itself becomes the visual anchor, reducing dependency on images.

### 7.5 Scrollytelling
Reveal content progressively as the user scrolls. Use Intersection Observer API to trigger block-level animations, creating an engaging narrative flow that keeps users scrolling.

### 7.6 Accessibility as Foundation (Not Afterthought)
The 2025 WebAIM Million report found 94.8% of the top one million homepages contain at least one detectable WCAG 2 failure, with low-contrast text appearing on 79.1% of homepages. Build accessibility from the foundation: proper contrast ratios, keyboard navigation, screen reader support, and adequate tap targets.

---

## 8. Best Practices Checklist

### Typography
- [ ] Body text ≥ 18px (ideally 21px for reading)
- [ ] Line height 1.5–1.65 for body, 1.1–1.3 for headings
- [ ] 50–75 characters per line (never exceed)
- [ ] Clear 3-level hierarchy (heading → subheading → body)
- [ ] Serif for content, sans-serif for UI
- [ ] Minimum 12px for any text element
- [ ] Custom/distinctive fonts — never Inter/Roboto/Arial as primary

### Color & Theme
- [ ] Warm neutral palette (yellow-brown undertone on all grays)
- [ ] Primary accent used sparingly for highest-signal moments
- [ ] 4.5:1 minimum contrast ratio for all text
- [ ] Complete light and dark mode support
- [ ] CSS custom properties for all colors
- [ ] No pure black (#000) or pure white (#FFF) as large surfaces

### Layout
- [ ] 680px max content width for reading
- [ ] 8px grid system for all spacing
- [ ] Mobile-first responsive design
- [ ] Breakpoints at 480, 768, 1024, 1280px minimum
- [ ] Generous negative space between sections (64–96px)

### Editor
- [ ] Block-based architecture (every element is a block)
- [ ] Slash command palette for block insertion
- [ ] Drag-and-drop reordering with visual feedback
- [ ] Inline formatting toolbar on text selection
- [ ] Keyboard shortcuts for all common operations
- [ ] Undo/redo with block-level granularity
- [ ] Offline editing capability with sync

### Interactive Elements
- [ ] Capsule-shaped primary buttons
- [ ] Glass/translucent effects on elevated UI elements
- [ ] Spring-based animations (200–300ms, slight overshoot)
- [ ] Scale feedback on press (0.97×) and hover (1.02×)
- [ ] Warm ring focus indicators
- [ ] 44×44px minimum tap targets
- [ ] Concentric border-radius on nested elements

### Accessibility
- [ ] Keyboard-navigable throughout
- [ ] ARIA labels on all interactive elements
- [ ] `prefers-reduced-motion` respected
- [ ] `prefers-reduced-transparency` respected
- [ ] `prefers-color-scheme` for dark mode
- [ ] Screen reader tested
- [ ] Focus-visible styling on all focusable elements

### Performance
- [ ] Lazy load images and heavy embeds
- [ ] Virtualize long document lists
- [ ] Single variable font file instead of multiple weights
- [ ] CSS-only animations where possible
- [ ] Glass effects degrade gracefully on older devices
- [ ] Core Web Vitals within "Good" thresholds

---

## 9. CSS Custom Properties Template

```css
:root {
  /* Claude-Inspired Color Palette */
  --color-bg-primary: #F5F4ED;
  --color-bg-secondary: #F0EEE6;
  --color-bg-tertiary: #E8E6DC;
  --color-surface: #FFFFFF;
  --color-text-primary: #1A1A18;
  --color-text-secondary: #5E5D59;
  --color-text-tertiary: #87867F;
  --color-accent: #C96442;
  --color-accent-hover: #AE5630;
  --color-border-light: #F0EEE6;
  --color-border-medium: #E8E6DC;
  --color-ring: #D1CFC5;
  
  /* Medium-Inspired Layout */
  --content-width: 680px;
  --content-width-wide: 1000px;
  --page-max-width: 1200px;
  
  /* Typography (Claude + Medium) */
  --font-serif: 'Copernicus', ui-serif, Georgia, Cambria, 
                'Times New Roman', Times, serif;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
               system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Source Code Pro', 
               'Fira Code', monospace;
  
  --text-body: 21px;
  --text-body-lh: 1.60;
  --text-h1: 44px;
  --text-h1-lh: 1.15;
  --text-h2: 32px;
  --text-h2-lh: 1.20;
  --text-h3: 24px;
  --text-h3-lh: 1.30;
  --text-small: 14px;
  --text-caption: 13px;
  
  /* Apple-Inspired Spacing */
  --space-unit: 8px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;
  
  /* Apple-Inspired Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 999px;
  
  /* Warm Shadows */
  --shadow-sm: 0 0.25rem 1.25rem rgba(26, 26, 24, 0.035);
  --shadow-md: 0 0.5rem 2rem rgba(26, 26, 24, 0.06);
  --shadow-lg: 0 1rem 3rem rgba(26, 26, 24, 0.08);
  
  /* Glass Effect */
  --glass-bg: rgba(255, 255, 255, 0.15);
  --glass-blur: blur(20px) saturate(180%);
  --glass-border: 1px solid rgba(255, 255, 255, 0.25);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  
  /* Animation */
  --ease-spring: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1.0);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #141413;
    --color-bg-secondary: #1F1E1B;
    --color-bg-tertiary: #2B2A27;
    --color-surface: #30302E;
    --color-text-primary: #EEEEEE;
    --color-text-secondary: #A0A09A;
    --color-text-tertiary: #7A7974;
    --color-border-light: #30302E;
    --color-border-medium: #3D3C38;
    --color-ring: #4D4C48;
    
    --glass-bg: rgba(255, 255, 255, 0.08);
    --glass-border: 1px solid rgba(255, 255, 255, 0.12);
    --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.15);
    
    --shadow-sm: 0 0.25rem 1.25rem rgba(0, 0, 0, 0.15);
    --shadow-md: 0 0.5rem 2rem rgba(0, 0, 0, 0.25);
    --shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.35);
  }
}

/* Accessibility Overrides */
@media (prefers-reduced-transparency: reduce) {
  :root {
    --glass-bg: var(--color-bg-secondary);
    --glass-blur: none;
    --glass-border: 1px solid var(--color-border-medium);
    --glass-highlight: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Technology Stack Recommendations (2026)

**Framework:** Next.js 15+ or Nuxt 4+ for SSR/SSG hybrid rendering

**Editor Engine:** TipTap (based on ProseMirror) — the most flexible block-based editor framework. Supports custom block types, slash commands, drag-and-drop, collaborative editing, and all the Notion-style patterns described above.

**Styling:** Tailwind CSS 4+ with custom theme tokens matching the CSS variables above, supplemented by CSS modules for component-specific styles.

**Animation:** Framer Motion (React) or Vue Motion for spring-based animations and layout transitions. CSS-only for micro-interactions (hover, focus).

**Fonts:** Self-hosted variable fonts via `@font-face`. Use `font-display: swap` for performance. Load serif body font first (above the fold), defer display fonts.

**Icons:** Lucide Icons (open-source, consistent stroke-width, tree-shakeable).

**State Management:** Zustand (React) or Pinia (Vue) for lightweight, block-level state.

**Real-time Sync:** Yjs or Liveblocks for collaborative editing and offline-first architecture.

---

*This specification document synthesizes the latest design patterns from Medium's content-first layout philosophy, Notion's block-based editing paradigm, Apple's Liquid Glass design language (WWDC 2025), and Claude AI's warm, human-centered aesthetic — creating a unified system that is readable, editable, interactive, and beautiful.*
