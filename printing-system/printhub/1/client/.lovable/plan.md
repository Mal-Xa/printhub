## Sora Print Hub — Frontend Build Plan

Mobile-first React + TanStack Start (project's installed stack) app with Indigo Professional theme, mock data, service-layer abstraction ready for future Firebase + REST backend, and Capacitor-friendly architecture.

> Note on stack: the project ships with TanStack Start + TanStack Router (not React Router DOM) and TanStack Query. I'll use those — they satisfy the brief's "React Router / TanStack Query / Vite / TS / Tailwind" intent and keep the project building. Capacitor-ready means avoiding browser-only APIs at module scope and isolating native-capable concerns (camera, filesystem, notifications) behind service adapters.

### Visual direction
- Palette: Indigo Professional (#1E1B4B bg-deep, #4F46E5 primary, #A5B4FC accent, #F8FAFC surface) wired as semantic tokens in `src/styles.css` with light + dark themes.
- Type: Inter via `<link>` in `__root.tsx` head; tracked headings, generous spacing.
- Components: shadcn (already present) styled to dashboard aesthetic — soft shadows, rounded-2xl cards, subtle indigo gradients on hero/CTAs.
- Theme toggle in header (persisted to `localStorage`).

### Architecture

```text
src/
├── routes/                       (file-based)
│   ├── __root.tsx                shell, theme, query provider, head meta
│   ├── index.tsx                 landing
│   ├── about.tsx  contact.tsx  privacy.tsx  terms.tsx
│   ├── login.tsx  register.tsx  forgot-password.tsx
│   ├── app.tsx                   user layout (sidebar + topbar + Outlet)
│   ├── app.index.tsx             dashboard
│   ├── app.orders.new.tsx        5-step wizard
│   ├── app.orders.index.tsx      my orders
│   ├── app.orders.$id.tsx        order detail
│   ├── app.files.tsx             my files
│   ├── app.passport.tsx          passport creator
│   ├── app.passport.saved.tsx    saved sheets
│   ├── app.profile.tsx
│   ├── admin.tsx                 admin layout
│   ├── admin.index.tsx           admin dashboard
│   ├── admin.orders.index.tsx    list + filters
│   ├── admin.orders.$id.tsx      detail + actions
│   ├── admin.printers.tsx        printers + queue + direct print UI
│   ├── admin.pricing.tsx
│   └── admin.analytics.tsx
├── components/
│   ├── layout/ (PublicHeader, AppSidebar, AdminSidebar, MobileNav, ThemeToggle)
│   ├── orders/ (FileDropzone, PrintOptionsForm, LaminationForm, BindingForm, OrderSummary, OrderStatusBadge, OrderCard, WizardStepper)
│   ├── passport/ (PhotoUploader, EditorCanvas placeholder, TemplatePicker, SheetPreview)
│   ├── admin/ (StatCard, OrdersTable, PrinterCard, QueueCard, PricingTable, AnalyticsCharts via recharts)
│   └── ui/ (existing shadcn)
├── services/
│   ├── apiClient.ts              fetch wrapper reading VITE_API_URL, auth header hook
│   ├── authService.ts            login/register/logout/me — mock; future Firebase swap
│   ├── orderService.ts           list/get/create/updateStatus — mock
│   ├── fileService.ts            list/upload/delete — mock (object URLs)
│   ├── passportService.ts        listSheets/saveSheet/delete — mock
│   ├── pricingService.ts         getPricing/updatePricing + computeOrderTotal(order, pricing)
│   └── printerService.ts         listPrinters/queue/sendPrint — mock
├── hooks/  (useAuth, useTheme, useMediaQuery, useOrderWizard)
├── lib/    (formatINR, mockData seed, mockDb in-memory store, fileTypes, validators with zod)
├── types/  (Order, OrderItem, File, PassportSheet, Printer, Pricing, User)
├── config/env.ts                 reads VITE_API_URL, VITE_FIREBASE_*
└── styles.css                    tokens, theme
```

`.env.example` with `VITE_API_URL=`, `VITE_FIREBASE_API_KEY=`, `VITE_FIREBASE_AUTH_DOMAIN=`, `VITE_FIREBASE_PROJECT_ID=`.

### Data + mock strategy
- All services return Promises with simulated latency, hitting an in-memory `mockDb` seeded with realistic Indian names, ~12 orders across all statuses, 8 files, 3 passport sheets, 2 printers, default pricing (B&W ₹2, Color ₹8, Cover Color ₹10, Passport sheet ₹40, Lamination ₹20–₹80 by type, Spiral ₹40).
- `computeOrderTotal` is the single source of pricing math, exercised in wizard summary + admin views.
- TanStack Query manages caching; queryKeys namespaced (`['orders']`, `['orders', id]`, `['pricing']`, etc).
- Auth: `authService` stores a mock session in `localStorage`; `useAuth` exposes `user`, `login`, `logout`. A simple client-side guard component redirects unauthenticated users from `/app/*` to `/login` and non-admins from `/admin/*`. (No protected server functions — frontend-only build.)

### Key flows

**Landing** — hero with two CTAs, services grid (4 cards), "How it works" 4-step strip, footer with legal links.

**Auth** — login, register (Full Name, Phone, Email, Password, Confirm with zod), forgot password (mock email sent toast). All forms react-hook-form + zod.

**User dashboard** — 4 stat cards (Active, Completed, Saved Files, Total), recent orders table (last 5), quick actions (New Order, Passport).

**New Order wizard** (`useOrderWizard` state machine, persisted to sessionStorage so refresh survives):
1. FileDropzone (react-dropzone) accepting PDF/DOCX/PPTX/JPG/PNG, list with size + remove.
2. Print options form (type, side, copies, paper A4, page range with custom input, cover checkboxes, remove-blank).
3. Lamination card (conditional sub-form: type select + qty) + Binding card (order-type radio; if "Binding Only" → docs count + estimated pages + info banner).
4. Special instructions textarea with example placeholder.
5. Summary: files, options, line-item pricing in ₹, total, Submit → calls `orderService.create`, toasts success, routes to `/app/orders/:id`.

**My Orders** — filter chips by status, responsive grid of `OrderCard`s. Detail page shows everything + status timeline.

**My Files** — grid with view (modal), download (anchor), delete (confirm), print again (preselects file then routes to wizard).

**Passport creator** — uploader, template picker (Passport/Visa/ID), editor stage with placeholder Crop/Zoom/Move/Rotate controls (UI only, non-functional buttons w/ tooltip "Coming soon"), live `SheetPreview` rendering a 4×6" CSS sheet with 3×3 grid and dashed cut guides. Save Sheet → mock save; Add To Print Order → seeds wizard.

**Profile** — editable name/phone/email, avatar placeholder (Capacitor Camera-ready via service stub).

**Admin** — separate `/admin` shell with its own sidebar.
- Dashboard: 4 stat cards (today orders, today revenue, pending, completed) + recent orders.
- Orders: table with status filter tabs, row → detail with all customer/print/lamination/binding/passport info, action buttons that call `orderService.updateStatus` and invalidate query.
- Printers: two printer cards (Canon LBP2900, Epson Color) with status pill, file viewer modal, Print/Reprint/Cancel buttons (mock). Queue list with status badges.
- Pricing: editable table, save persists to `mockDb` + toast.
- Analytics: recharts cards — bar (orders by day), line (revenue this month), donut (popular services), KPI cards.

### States, a11y, responsive
- Skeletons for every query-bound view; empty states with illustration + CTA; error states with retry; success toasts via sonner.
- All inputs labeled, focus rings preserved, keyboard nav on wizard + tables, 44px tap targets, `h-dvh` on full-height shells.
- Mobile: sidebar collapses to bottom tab bar on `< md` for user/admin shells; tables become stacked cards.

### Capacitor / Firebase readiness
- No `window`/`document` access at module scope; browser-only code lives inside effects or handlers.
- `services/*` are pure interfaces — swapping `authService` mock for Firebase Auth later is a one-file change.
- A `lib/native.ts` stub exposes `camera.takePhoto()`, `filesystem.save()`, `notifications.register()` with web fallbacks today and `@capacitor/*` imports gated behind a runtime check, ready to wire when Capacitor is added.

### Out of scope (explicit)
- No real auth, no real uploads (files held as object URLs in memory), no actual printer integration, no payment.
- No Capacitor install yet — only architectural readiness.
- No backend — every service is mock.

### Deliverable
A single cohesive build covering every route/component listed above with seeded mock data so the entire app is clickable end-to-end in both user and admin contexts, light + dark, mobile + desktop.
