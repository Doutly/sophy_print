# Sophy Print — Premium Frontend Plan

## Goal
Build the complete frontend first: a premium, mobile-first printing experience students can complete in three clear steps, plus an operational shop-admin workspace. Firebase, real payments, printer communication, and persistent data will be connected later.

## Student experience

1. **Upload**
   - Open directly on a focused “Print without the queue” screen with Sophy Print branding.
   - Accept PDF drag-and-drop or file browsing, then show a polished mock document analysis state with filename, page count, paper size, and validation feedback.
   - Keep “Track existing order” available without requiring registration.

2. **Configure**
   - Present copies, black-and-white/colour, single/double-sided, and A4/A3 as fast, touch-friendly controls.
   - Recommend the printer automatically rather than asking students to choose a machine.
   - Keep a live, sticky price summary visible as choices change, using clearly labelled demo pricing from the PRD.

3. **Review & pay**
   - Show the document, settings, assigned printer, and complete rupee price breakdown.
   - Use a frontend-only payment simulation for now; make it explicit that it is a preview rather than a real transaction.
   - Continue to a realistic order tracker with paid, queued, printing, ready-for-pickup, pickup-code, and collected states.

## Admin experience

- Add a dedicated `/admin` workspace with a compact sidebar and premium operational layout.
- Include overview metrics, live print queue, printer health, order history, revenue, and pricing management views.
- Provide working frontend interactions for queue filtering, search, pause/cancel/retry actions, pricing edits, and marking an order collected.
- Populate all views with coherent sample orders and the Kyocera/Epson machines from the brief; clearly treat changes as non-persistent demo data.
- Do not add authentication yet; the admin entry is a frontend preview until Firebase is supplied.

## Visual direction

- **Brand:** Sophy Print.
- **Palette:** Midnight Mint — deep charcoal `#0C1110`, dark surface `#18211E`, soft white `#F5F7F6`, mint accent `#38D39F`.
- **Typography:** Space Grotesk headings with DM Sans body text.
- **Student layout:** focused single-column flow with one primary action at a time, generous spacing, crisp dividers, and restrained 6–8px radii.
- **Admin layout:** dense but calm operational dashboard, optimized for quick scanning rather than decoration.
- Use subtle entrance, progress, and success animations with reduced-motion support; no ornamental gradients or generic floating effects.
- Define the palette and typography as reusable semantic tokens so every screen remains consistent and accessible.

## Routes and structure

- `/` — the complete three-step student print flow.
- `/track` — existing-order lookup and sample tracking experience.
- `/admin` — admin overview.
- `/admin/queue` — live queue.
- `/admin/machines` — printer and gateway status.
- `/admin/orders` — searchable order history.
- `/admin/pricing` — editable demo rates.
- `/admin/revenue` — daily, weekly, and monthly summaries.
- Use shared student and admin components, with route-specific page titles and social descriptions.

## Frontend-only behavior

- Keep uploaded files in browser memory only and never send them anywhere.
- Simulate PDF analysis, payment success, queue progress, printer heartbeats, and admin updates with local state and short delays.
- Centralize mock data and service boundaries so Firebase can replace them later without redesigning the screens.
- Disable or label actions that cannot be real before the Firebase SDK, payment gateway, and print gateway are connected.

## Quality checks

- Verify the full student journey and key admin actions in the running preview.
- Check phone and desktop layouts for overflow, legibility, clear focus states, and touch target sizes.
- Add route coverage for every linked page and confirm the preview builds without errors.

## Not included yet

- Firebase SDK, database, storage, authentication, or real-time listeners.
- Razorpay or any real payment processing.
- Windows print gateway or physical printer integration.
- Real notifications, persistent uploads, orders, pricing, or analytics.