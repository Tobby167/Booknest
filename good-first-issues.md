# GitHub Issues & Task Templates

This file contains pre-written task descriptions that you can copy and paste directly into GitHub Issues for your team project. It contains a mix of **coding** and **non-coding** tasks, categorized by level of difficulty.

---

## 📄 Non-Coding & Documentation Issues

### Issue 1: Create a Project Design and Branding Guide (`DESIGN.md`)
* **Labels**: `documentation`, `good-first-issue`, `non-coding`
* **Difficulty**: Easy

#### Description
To ensure our team maintains a consistent UI/UX standard when adding pages or widgets, we need a unified styling and design guidelines document.

#### Tasks
1. Create a new markdown file named `DESIGN.md` in the root of the project.
2. Outline the color palette used in the project (refer to Tailwind colors in `tailwind.config.ts` and `src/app/globals.css`).
3. Define font sizing hierarchy and typography styles (headings, body text, buttons).
4. Outline standards for UI state transitions (e.g., hover effects, button loading states, error fields).
5. Document best practices for responsive design (mobile-first approach).

#### Acceptance Criteria
* `DESIGN.md` is added to the repository.
* Content details typography, color palettes, and interactive component states.
* No compile errors are introduced.

---

### Issue 2: Create a Manual Verification & Testing Guide (`TESTING_GUIDE.md`)
* **Labels**: `documentation`, `testing`, `non-coding`
* **Difficulty**: Medium

#### Description
We need a step-by-step testing guide so that any team member can manually verify that all parts of BookNest (Signup, Booking, Dashboard, Payments) work correctly before merging code.

#### Tasks
1. Create a file named `TESTING_GUIDE.md` in the root folder.
2. Draft a complete "Smoke Test" sheet covering:
   - User signup, email verification, and login.
   - Salon profile settings changes (logo uploads, contact info).
   - Availability slot scheduling and blocked dates creation.
   - Client-side booking experience (selecting date, time, and service add-ons).
   - Uploading a mock bank receipt.
   - Dashboard notifications updates and manual WhatsApp confirmation buttons.

#### Acceptance Criteria
* `TESTING_GUIDE.md` details distinct manual test scenarios.
* The document describes expected vs. actual outcomes for core client and admin actions.

---

## 💻 Coding Issues

### Issue 3: Implement Copy-to-Clipboard Button for Embed Code
* **Labels**: `enhancement`, `good-first-issue`, `coding`
* **Difficulty**: Easy

#### Description
On the `/dashboard/embed-code` settings page, the owner is shown an `<iframe>` snippet to copy. Currently, they have to select the text manually. We should add a "Copy Code" button with a brief success state (e.g., changing text to "Copied!" for 2 seconds).

#### Location
- File: [src/app/dashboard/embed-code/page.tsx](file:///c:/Users/Adetola/Desktop/Acuity/src/app/dashboard/embed-code/page.tsx)

#### Tasks
1. Add a button next to or below the code textarea.
2. Implement clipboard writing using the browser's `navigator.clipboard.writeText()` API.
3. Add a temporary state change to show success feedback ("Copied!") when clicked.
4. Style the button to match the existing dashboard theme.

#### Acceptance Criteria
* Clicking the button copies the correct iframe code to the clipboard.
* The UI displays a visual confirmation state.
* The changes compile and typecheck without errors.

---

### Issue 4: Replace throw block in Email Service with Mock Successful Delivery
* **Labels**: `enhancement`, `good-first-issue`, `coding`
* **Difficulty**: Easy

#### Description
When a booking is confirmed, the system should trigger an email. Currently, [futureEmailProvider.ts](file:///c:/Users/Adetola/Desktop/Acuity/src/services/notifications/futureEmailProvider.ts) throws an error stating it is not configured. We should replace the error throwing with a mock success function that writes the simulated email event to the developer console and creates an in-app notification.

#### Location
- File: [src/services/notifications/futureEmailProvider.ts](file:///c:/Users/Adetola/Desktop/Acuity/src/services/notifications/futureEmailProvider.ts)

#### Tasks
1. Remove `throw new Error("Appointment email provider is not configured.");`
2. Add a `console.log` listing the recipient email and details to simulate email delivery.
3. Simulate latency using `await new Promise(resolve => setTimeout(resolve, 500))`.
4. Ensure no TS errors are introduced.

#### Acceptance Criteria
* Replaced the `throw` statement.
* System logs the mock email output successfully without crashing.

---

### Issue 5: Add Search Filter on Dashboard Clients Page
* **Labels**: `enhancement`, `coding`
* **Difficulty**: Medium

#### Description
On the `/dashboard/clients` dashboard page, owners see a list of their customers. We need a search box at the top of the client list to filter clients by name, phone number, or email in real-time.

#### Location
- File: `src/app/dashboard/clients/page.tsx`

#### Tasks
1. Add an input field for search queries above the client table.
2. Use a React state variable `searchQuery` to store the input.
3. Filter the client list client-side based on whether `name`, `email`, or `phone` includes the search string (case-insensitive).
4. Display a "No clients found" placeholder state when the filter matches nothing.

#### Acceptance Criteria
* Typing in the search input dynamically updates the displayed rows.
* Typing clear/empty query shows the full list.
* Passes typechecking and build tests.
