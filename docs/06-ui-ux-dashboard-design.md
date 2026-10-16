# UI/UX Wireframe Descriptions & Dashboard Design

## 1. Global Layout
A persistent **left sidebar** (module branding + navigation: Dashboard, Routes & Network, Rates & Tariffs, SOP Manager, Schedules & Timetable) paired with a **top bar** showing the page title and the current user's role badge. This shell is shared by every authenticated page so navigation never disappears while working.

## 2. Login Screen
Centered card on a dark navy gradient background. Fields: username, password. On failure, an inline red message appears below the form rather than a browser alert, keeping the user in context. Demo credentials are listed for grader/tester convenience.

## 3. Dashboard
- **Stat cards row** (4 cards): Active Routes, Approved Tariffs, Published SOPs, Schedules Today — each a single large number with a label, giving an at-a-glance operational snapshot.
- **Upcoming Schedules table**: next 8 scheduled transits with route, times, vehicle, and status badge.
- **Recent SOP Activity table**: last updated SOPs with status badge, so managers see what needs review without navigating away.

## 4. Routes & Network Planner
- **Toolbar**: status filter, origin/destination text filters, search button, and a prominent "+ New Route" button (hidden for read-only roles).
- **Table columns**: Code, Name, Origin, Destination, Distance, Status (color-coded badge), Provider, Actions.
- **Create/Edit modal**: name + origin/destination fields, estimated travel time, and a **dynamic stop list** — each stop is a row with name + distance-from-origin, addable/removable, preserving sequence by row order. This directly supports FR-1.2 (stop management) without a separate page.
- Row actions include contextual status transitions (Activate / Deactivate / Reactivate) so status changes never require opening the full edit form.

## 5. Rate & Tariff Management
- **Table columns**: Code, Service, Vehicle, Base Rate, Surcharge, computed **Total** (bold, visually distinct since it's the number planners care about most), Status, Actions.
- **Create modal**: grouped fields (service/vehicle type, weight range, distance range, monetary fields, dates) and a **live-computed total preview** that recalculates on every keystroke — this directly demonstrates FR-2.3 to the user before they even save.
- **Workflow buttons are status-driven**: only the transitions valid from the tariff's current state are rendered (Draft→Submit, Pending→Approve/Reject, Approved→Archive), preventing invalid transitions at the UI layer as well as the API layer.

## 6. SOP Manager
- **Search bar + category/status filters** sit above the table, supporting FR-3.6 (search).
- **Table columns**: Code, Title, Category, Version (e.g. "v2" — makes version control visible at a glance), Status badge, Updated date, Actions.
- **Create modal**: title, category dropdown, description textarea. Editing a Published SOP transparently creates a new version behind the scenes; the version number visibly increments in the table so the workflow (FR-3.2) is legible to the user without extra clicks.

## 7. Schedules & Transit Timetable
- **Table columns**: Code, Route, Departure, Arrival, Vehicle, Status, Actions (Start Transit / Complete / Log Delay / Cancel, shown contextually by current status).
- **Create modal**: route dropdown (auto-fills departure/arrival location from the selected route), datetime pickers for departure/arrival, vehicle code. On submit, if the backend detects a conflict (FR-4.2), the toast notification names the conflicting schedule code directly — turning a rejected request into an actionable message rather than a generic error.
- **Delay modal**: reason + revised arrival time; submitting immediately flips the schedule's status badge to "Delayed" in the table.

## 8. Visual Language
- **Color:** navy (#0f2438) for structure/branding, warm amber/orange accent (#d9822b) for primary actions — evokes freight/logistics without leaning on a generic corporate blue-on-white template.
- **Status badges** use consistent semantic coloring across all four modules (green = good/approved/active, amber = pending/in-progress, red = rejected/cancelled/inactive) so a user learns the color language once and reuses it everywhere.
- **Tables over cards** for list views, since the target users (planners, managers) are doing comparison and bulk-scanning work, not browsing — density and scannability were prioritized over decorative whitespace.
