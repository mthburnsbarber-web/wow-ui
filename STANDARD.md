# The Wow UI Standard

Written by Michael Barber at Black Label Tec, October 2026, after the redesign of the Ace iPhone app. It is the default for every interface we build: apps, websites, dashboards, onboarding, emails, installers, menus, sheets and error states. A screen that ships without meeting it is unfinished. Functional bugs still come first; the wow never excuses a button that doesn't work.

The test is one question: **would a stranger say "holy shit, this is insane" within five seconds, and then find that everything actually works?**

---

## The prompt

Paste this at the top of any UI task, for any AI:

> Build this interface as an art object, not a layout. Before writing code:
>
> 1. **Choose one physical world for the product** and make every element a real object in it. (A card table at night: playing cards, gold chips, lacquer, felt, gold leaf, engraving.) Not a theme or a palette — a world with materials, weight and light.
> 2. **Design one signature hero object** that is touchable, reacts to the device (gyroscope tilt or pointer), catches light (foil sheen plus a periodic glint), has physical weight (springs, never linear fades), and appears everywhere: launch, sign-in, home, loading, success, voice, empty states, icons.
> 3. **Turn every control into an object from that world.** A button is a chip that flips like a tossed coin between its faces; suggestions are a hand of cards fanned in your hand; a balance is a stack of chips that drop in with a click; a tab bar is a card that slides between tabs; an error is the Joker; loading is a dealer's riffle shuffle; a code entry is the back of a card that flips over; success deals you in.
> 4. **Give every motion a verb from that world** — deal, flip, toss, stack, play, shuffle, cut, reveal — with spring physics, staggered arrivals and a matching haptic. Nothing simply fades in.
> 5. **Build a material system and apply it globally through the design tokens, so every screen changes at once:** a near-black lacquer base; one precious metal as a three-stop gradient with a highlight (never flat yellow); engraved hairlines (an outer rim that catches light at the top, plus a second rule just inside, like a fine playing card); a guilloché rosette (banknote line work) as a signature texture, faint and slowly turning; a warm key light from above; an edge vignette; device-resolution film grain.
> 6. **Use the hardware:** gyroscope parallax and foil, haptics tied to physical events (soft ticks while text streams, a tap when a card lands, success when you're in, error on a wrong code), audio-level-reactive visuals in voice, GPU shaders for ripples, holographic foil and particle bursts at the big moments.
> 7. **Design every state as an object:** first launch, sealed and opening, signed out, loading, streaming, empty, error, success, offline, landscape, large text. No control ever does nothing silently — if it can't act, it says why, in the world's language, with the fix one tap away.
> 8. **Ship the craft, not the concept:** textures at device resolution (no 1× noise on a 3× screen), decorations as overlays that never change layout, 60 fps, Reduce Motion fallbacks, Dynamic Type, landscape, accessibility labels on every object, and no clipped text where objects overlap (cards held in a fan read from the visible edge).
> 9. **Be unmistakably yours.** Never echo another AI product's signature: no rotating star or asterisk, no four shapes turning in a square, no pulsing orb or black dot, no ChatGPT, Claude or Gemini look-alikes. If a stranger could mistake a motion for theirs, redesign it from your own world.
> 10. **Judge it as one artwork:** screenshot every screen into a single contact sheet before and after, fix whatever breaks the world, then run it on a real device and check it by hand.

---

## What "good" looks like

The card-table world, from the Ace iPhone app:

| Surface | Ordinary | Wow |
|---|---|---|
| First launch | Logo, text, Continue | A wax seal that cracks open, a rosette turning around it; the letter reads itself aloud with the spoken word glowing gold leaf |
| Sign-in | Three buttons | A portrait Ace of Spades dealt onto the table, foil tracking the gyroscope, an engraved rosette, a glint; it flips to "Dealing you in" while sign-in works; the email code is typed onto the back of the card, each digit lighting gold; a wrong code shakes and the gold cools to grey |
| Composer button | A gold circle | A gold casino chip — edge inlays, engraved ring, lacquer centre — tilting with the phone, breathing when it can talk, spinning like a tossed coin as it turns from Talk to Send |
| Suggestions | 2×2 grid of tiles | A hand of four playing cards (Q♥ J♦ K♣ A♠) fanned in your hand, dealt in with soft haptics; tap one and it's played |
| Thinking | Spinner or dots | A dealer's riffle shuffle: a small deck splits, riffles back together card by card, squares up, and the top card catches the light |
| Balance | A number in a card | The number in gold leaf beside a stack of chips that drop in one by one with a click |
| Tab bar | Icons with a tint | A lacquer rail with a gold inlay; the selected tab sits on a gold-leaf card that slides across with a selection tick |
| Permissions | "On" pill | Each granted permission turns face-up as a gold card |
| Errors | Red text | The Joker, with the exact reason and the fix |
| Pairing done | "Paired" text | A card dealt face-down that flips to show your computer's name, with a ring of light |

## Choosing the world for other products

Same rules, different world. Pick something with real materials and real verbs. These six ship as token sets in `worlds/worlds.css`:

- **Card table:** lacquer, felt, gold leaf — deal, flip, toss, stack.
- **Studio console (audio):** brushed aluminium, VU needles with real ballistics, knobs with detents and haptic clicks, valve amber glow, tape reels that spin while rendering.
- **Blueprint (real estate, architecture):** drafting film and brass — ink lines that draw themselves, brass instruments, an embossed deed seal on success.
- **Bond certificate (finance):** guilloché borders, intaglio numerals, tape that prints prices, a wax seal on confirmations.
- **Night watch (home, security):** lantern light, a radar sweep, frosted glass panels, a heartbeat that's actually measured.
- **Film studio (video, marketing):** clapperboard, light leaks, a projector beam for previews, a reel that spins while rendering.

## The kit

| Standard | Kit |
|---|---|
| Lacquer, key light, vignette, grain | `.wow-scene` on `<body>`; `wow.grain()` paints grain at the screen's real pixel density |
| Metal, never flat yellow | `var(--wow-metal)`, `.wow-metal`, `.wow-leaf` for type, `.wow-button` |
| Engraved double rule | `.wow-plate`, `.wow-rule`, `--wow-rule`, `--wow-rim` |
| Guilloché rosette | `wow.guilloche()`, `data-wow-rosette`, `.wow-rosette` |
| Hero object that tilts and catches light | `wow.tilt(el)` or `data-wow-tilt`, with `.wow-tilt .wow-foil .wow-glint` |
| Controls as objects | `.wow-chip`, `.wow-card`, `.wow-stack`, `.wow-flip`, `.wow-code`, `.wow-joker`, `.wow-riffle` |
| Motion verbs with springs | `wow.deal()`, `wow.flip()`, `wow.toss()`, `wow.stack()`, `wow.play()`, `wow.shake()`, `wow.burst()`; CSS `var(--wow-spring-*)` |
| Haptics on physical events | `wow.haptic('tick' \| 'tap' \| 'land' \| 'success' \| 'error')` |
| Reduce Motion | Every kit animation stops or becomes a short cross-fade; `wow.reducedMotion()` |
| Judge it as one artwork | `wow-ui sheet` |
| The banned list | `wow-ui lint` |

## Implementation recipes

**SwiftUI (iOS):** `CMMotionManager` device-motion attitude, low-pass filtered, mapped to `rotation3DEffect` and a foil gradient offset. Guilloché from summed sine rings in a `Shape` (port `wow.guilloche()`; it is twenty lines). Film grain is a random-byte `CGImage` created at `UIScreen.main.scale`, tiled and nudged by `TimelineView` twelve times a second. Glint is a masked gradient sweep every few seconds. Springs: `.spring(response: 0.4–0.9, dampingFraction: 0.65–0.85)` — the same two numbers `wow.spring()` takes, so web and native move identically. Haptics: `UIImpactFeedbackGenerator` soft/light/rigid, `UISelectionFeedbackGenerator`, `UINotificationFeedbackGenerator`. GPU: `ShaderLibrary` with `.layerEffect`/`.distortionEffect` for ripples and holographic foil. 3D hero: SceneKit `SCNShape` extrusion with chamfer and a physically based metal material lit by a procedural environment.

**Web:** CSS custom properties driven by `pointermove` and `deviceorientation` for tilt and foil; `conic-gradient` plus `mix-blend-mode` for holo; a canvas noise tile at `devicePixelRatio` for grain; SVG paths for guilloché; the Web Animations API with springs exported as CSS `linear()` for deal and flip; `navigator.vibrate` where supported; Web Audio for amplitude-reactive visuals. No library is required — this kit is one CSS file and one JS module.

## Banned

Flat grey-bordered cards. Stock spinners. Plain fades. Linear easing on one-shot motion. Unstyled system segmented controls. A corner button that is "just okay". Icons without a material. Defaults unrelated to the product's world. Any control that silently does nothing. Decoration that shifts layout or blurs text. A "finished" claim backed by a mockup instead of the running product.

`wow-ui lint` enforces the parts of this list a machine can see. The rest is the contact sheet and your own eyes on a real device.
