---
name: wow-ui
description: Interface standard for building UI as an art object instead of a layout — one physical world per product, a hero object that tilts and catches light, every control an object from that world, spring motion with haptics, a global material system, every state designed. Load before designing or changing any interface, screen, component, onboarding, sign-in, empty/error/loading state or visual style. Includes a zero-dependency CSS/JS kit, a linter that fails flat UI, and a contact-sheet tool.
---

# Wow UI

1. Read `STANDARD.md` in this folder in full before writing UI code, and follow it. Fix reported functional bugs first.
2. Choose the product's world before writing code. If one of `worlds/worlds.css` fits, use it; otherwise write a new token block with the same names.
3. Web work: use the kit instead of improvising materials and motion.
   - `kit/wow.css` (materials, objects, springs as CSS custom properties) and `worlds/worlds.css`.
   - `kit/wow.js` (`spring`, `guilloche`, `tilt`, `grain`, `deal`, `flip`, `toss`, `stack`, `play`, `shake`, `burst`, `haptic`, `auto`).
   - Copy them into the project or load them from `https://cdn.jsdelivr.net/gh/mthburnsbarber-web/wow-ui@v1.0.0/`.
   - Native work: follow the recipes in `STANDARD.md`; use the same spring numbers (`response`, `dampingFraction`).
4. Before calling the work done, run the linter on the changed files and fix every finding, or suppress it with a reason:
   `node <this folder>/cli.mjs lint <changed files or folders>`
5. Photograph every screen and state into one contact sheet, before and after, and look at it as one artwork:
   `node <this folder>/cli.mjs sheet "Home=http://localhost:3000/" "Sign in=http://localhost:3000/login" --out sheet.png`
6. Run it on a real device and check it by hand. A mockup or a passing lint is not done.
