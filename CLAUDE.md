# Vya Pulse CRM — Claude Code Instructions

## Design Language

These rules are non-negotiable and apply to every UI component, page, and modal in the project.

### Color
- **Dark mode background:** `#0C0C0B` (near-black, never pure `#000000`)
- **Light mode background:** `#FAFAF8` (warm off-white, never pure `#FFFFFF`)
- **Accent:** Muted gold, low saturation. No purple gradients. No blue gradients. Ever.

### Typography
- **Display headings:** Playfair Display
- **UI / body / labels:** Inter
- No other fonts. Do not introduce new typefaces.

### Icons
- **Library:** `@phosphor-icons/react` only
- **Weight:** `light` only — one stroke weight across the entire app
- Never mix icon libraries or weights

### Shape & Depth
- **Border radius:** 0–4px max. Sharp corners, never pill-shaped cards.
- **Depth:** Use borders for depth — no drop shadows, no glassmorphism
- **No emojis in UI** — ever

### Spacing
- Strict 4px / 8px scale
- Generous whitespace — err on the side of more space, not less

### Motion
- Subtle springs via `motion/react` (Framer Motion)
- Always respect `prefers-reduced-motion` — wrap all animations
- No gratuitous motion; every animation must serve a purpose

### Component Libraries (use these, not alternatives)
| Need | Package |
|------|---------|
| Toasts / notifications | `sonner` |
| Drawers / bottom sheets | `vaul` |
| Command palette | `cmdk` |
| Animated numbers | `@number-flow/react` |
| List / DOM auto-animation | `@formkit/auto-animate` |

### What to Avoid
- Pure black or white backgrounds
- Purple or blue gradients
- Drop shadows for depth
- Glassmorphism (backdrop-blur decorative layers)
- Emojis in UI
- Non-Phosphor icon libraries
- Non-light Phosphor weight
- Border radius above 4px on cards/containers
- Fonts other than Playfair Display (display) and Inter (UI)
