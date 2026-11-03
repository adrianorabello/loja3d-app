# Fuse - Admin template and Starter project for Angular

## Sign-in

`/sign-in` follows the updated responsive prototype: blue product showcase and a
white sign-in panel with pink accents. Below 840px the panels stack; there is one
reactive form at every width, so resizing preserves credentials and pending state.
The showcase loads up to three active products from the public API, newest first,
using real names, photos and EUR prices. Empty/loading/error states do not block
sign-in; catalogue errors offer a retry. The seven-second carousel can be paused,
pauses on hover/focus and respects reduced motion.
Copy uses pt-PT with English/German translations. Authentication, remembered-session
payload and redirect URLs are unchanged; recovery and registration link to the
existing routes. No demonstration access or decorative social-login buttons.

## Support chat (opt-in)

Customer `/account/chat[/:id]` and admin `/admin/chat[/:id]` reuse one workspace
and root session store, also presented in a global Fuse drawer. Material/Fuse
controls use the existing rose theme. Text, private image previews and file
downloads use the real API; no demo chat endpoints or public contact directory.

Local `npm start` now enables the chat on **http://localhost:4201**, using the
current store API on port 8000 and the existing accounts. The API requires
`CHAT_ENABLED=true`, the initialized `store-rs` MongoDB replica set, Redis/scanner
and a running `python -m app.workers.chat` process. Production remains opt-in.
For isolated development,
start the API/worker/Compose stack documented in
[API chat operation](../loja3d-api/docs/chat.md), then run `npm run start:chat`
and open **http://localhost:4203**. This configuration proxies HTTP and WS to
port 8001 and uses separate accounts/data, not the existing store DB.
For deployed builds, the environment generator accepts `CHAT_ENABLED=true`;
`API_URL` supplies the HTTP and native WS origin. Backend activation is separate.

Drafts and unbound file references stay in memory only for the current identity.
While signed in, a visible online tab reconciles conversations and the selected
history over REST every 10 seconds, even when the WebSocket reports connected.
Socket events still trigger immediate synchronization. This repairs missed events
without a browser reload; it does not replace the production outbox/attachment
worker. Polling stops on logout and skips hidden/offline tabs.
Failed sends preserve the draft and retry key; logout clears it. Sent messages
and files persist server-side. The page hides the floating compositor; switching
between page and drawer does not create another socket. Unread badges update
without redirecting the user; reads require an open, focused conversation at its
bottom. Existing request-status notifications are unchanged.
When enabled, the right-hand chat drawer opens automatically on the first eligible
page for each signed-in identity. Closing it is respected during that session;
message updates and normal navigation do not reopen it. Authentication and dedicated
chat pages keep the drawer closed.

## Personal profile and photo

`/account/profile` loads the signed-in user's real profile from `/api/v1/users/me`.
Customers and administrators can edit name (2-100 trimmed characters), optional
E.164 phone/country, birth date (1900 through today) and existing addresses.
Email is read-only: changing it requires the separate backend confirmation flow.
Cancel restores the latest server-confirmed details; failed saves retain the draft.
Finish or cancel an open address editor before saving. Data and photo have separate
save actions and cannot submit simultaneously.

Photo selection uses the Fuse contacts/avatar pattern, with preview and explicit
save/remove actions. JPEG/PNG input is limited to 10 MiB and 16 million pixels.
The API decodes and normalizes a single frame to JPEG, up to 512 x 512 and 512 KiB,
removing metadata. Bytes are stored in MongoDB, not localStorage or a preview URL.
Authenticated `GET /api/v1/users/me/avatar` supplies the image as a Blob.
The shared avatar service caches only the current user/version in memory and
revokes object URLs on replacement, sign-out and last-view teardown.
The storefront and active admin shell/menu follow UserService updates without
requiring a new login. Read/upload failures are visible and retryable.
An expired session keeps the draft on screen instead of forcing a reload; navigating
to sign in leaves that draft, so the UI warns to copy needed values beforehand.
No social-login, email-change UI or image-cropping editor is introduced.

## Product photos

The admin create/edit form is horizontally centred within the content area with
a responsive maximum width. The product-list sidebar entry uses exact route
matching in both the API navigation and mock navigation so adding a product does
not also highlight the list entry.

Admin product photo selection still previews JPEG/PNG locally (up to 2 MiB per
file, separate from the profile's 10 MiB limit). On Save, the real API converts
the transport data URLs to BSON binary in the MongoDB product document and
returns public image endpoint URLs. Catalogue cards, details, cart and admin
previews use those URLs without embedding Base64 in catalogue JSON.
The API validates actual content, at most 16 million pixels and no animation.
Invalid images or the product's total 16 MiB storage limit produce a visible
error and leave the form draft intact. Existing asset/HTTP(S) references remain
supported; old inline images convert when their product is next saved.
Mock mode remains an in-memory demo and does not provide durable storage.

## Fullscreen sign-in

The sign-in page uses Fuse's Fullscreen Reversed presentation: edge-to-edge
decorative panel on the left and form on the right from 768px upwards.
Below 768px the form occupies the full viewport without a floating card.
Content can scroll on short screens; resizing preserves the form, validation
and in-flight state. The empty auth shell and post-login redirects are unchanged.
Remember-me starts as `false` (a boolean), matching the real API contract and
avoiding a validation error on the first sign-in submission.

## Custom print requests

The store now includes a persisted custom-print workflow backed by `loja3d-api`.

- Customers: `/account/requests`, `/account/requests/new`, `/account/requests/:id`.
- Administrators: `/admin/requests`, `/admin/requests/:id`.
- Entry points: home custom-print buttons, storefront navigation, account menu,
  profile page, footer and admin navigation.

The request pages reuse Fuse alerts, the shared confirmation dialog and Angular
Material forms, tables and paginator. They follow the existing Angular layout,
not the React prototype's demo controls. UI text is available in pt-BR, en and de.

Requests, quotation revisions, messages and workflow history are stored by the
backend. All changes carry the version of the request being viewed; conflicts
require refreshing and reviewing the latest state. Approvals also carry the
quotation version. The backend determines permitted actions and transitions.

The creation page uses an illustrated six-stage process overview, a wide form
and a live draft-summary/checklist sidebar. These are not saved progress:
only Request is highlighted as being prepared, and no stage is marked complete.
The sidebar reads the existing form, including empty optional values and link
count; it does not save drafts or invent prices/shipping estimates. Desktop
cards sit side by side at 1280px and stack below that width. Existing themes,
Portuguese/English/German translations and field-level validation are preserved.

Creation and saved customer/admin details reuse the same illustrated workflow
component. Saved requests use the backend status to show completed stages with
mint backgrounds/light-green borders and green checkmarks, the current stage
in blue with pink accents and a blue highlight travelling around its border,
and pending stages in muted grey. The six inline SVG illustrations (including
the 3D printer) and colour values match the read-only React prototype's workflow.
These colours are scoped to the workflow; app typography and theme are unchanged.
Delivered requests show all six stages complete; cancelled and
rejected requests retain their explicit status text without an active stage or
invented completion history.
With reduced motion enabled, the current border is static. The animation is
decorative and does not represent printing speed or live progress.

Shipment tracking links are optional when marking a request shipped. Non-empty
links must be valid HTTP(S) URLs; the tracking button is shown only when a link
exists. A recorded transition reason is still required.

### Running against the backend

Signed-in customers receive Fuse alerts in the upper-right corner when the team
changes the status of their custom-print requests while the app is open.
The app polls all pages of the customer's requests every 15 seconds, using the
first successful response as its baseline (no historical/offline alerts).
History event IDs prevent duplicate alerts; customer actions and admin messages
that do not change status do not notify. Alerts close after 10 seconds or can be
dismissed/opened manually. Polling errors are visible and retried; sign-out clears
alerts and stops polling. This is not push/email and does not cover purchase orders.
Only the existing ADMIN role can perform team updates; no new attendant role is
introduced. Mock mode does not run the real-API notification polling.

The storefront header shows Home, Products and More, in that order. More contains
custom-print and personal request links, plus profile/admin links where applicable.
Mobile navigation exposes the same menu and preserves the account/cart controls.

Start the API locally on port 8000 with its own test/development MongoDB database.
Local development uses real authentication and persisted requests by default:

```bash
npm start
```

Relative API URLs are proxied to `http://127.0.0.1:8000`. Sign in with a real
customer account, or sign up; the demo customer credentials are not seeded in the
backend. Guests are sent to sign in and returned to the request form after login
or registration. Submitting a valid form saves the request before opening its
tracking page. Creation is customer-only; administrators manage requests through
the admin area.
Required text is validated before submission: title 3-150 characters,
description 10-5000 and dimensions 2-200, with leading/trailing spaces trimmed.
Include a unit in the dimensions, for example `1 cm`. Field-level messages also
identify fields rejected by backend validation, without discarding the input.

For deployment use the existing `build:vercel` configuration,
set `USE_MOCK_API=false`, and configure backend CORS for the store's exact origin.
The in-memory demo can still be enabled with `useMockApi: true` in
`src/environments/environment.ts`, but its authentication tokens cannot be used
with the persisted request API. After switching from mock to real authentication,
sign in again to replace any old demo session.

### Agreed first-version scope

- Reference links only: up to five HTTP(S) links, no binary uploads or file storage.
- Manual administrator payment verification; no gateway, automatic charges or
  payment-proof uploads. Agree payment instructions with the store separately.
- Customers may cancel before payment confirmation; administrators handle later
  cancellations with a recorded reason. No automatic refunds.
- No automatic emails for request updates. Customers use the tracking page and
  recorded messages; the refresh button retrieves current state.
- No private administrator notes: all messages/history in this feature are
  customer-visible.
- The six-stage tracker is not live printer telemetry or a completion percentage.

### Focused verification

```bash
npm test -- --watch=false --browsers=ChromeHeadless \
  --include=src/app/core/print-requests/print-request.service.spec.ts \
  --include=src/app/domains/print-requests/print-requests.component.spec.ts \
  --include=src/app/domains/storefront/home/home.page.spec.ts
npm run build
```

Use an isolated backend/database for real customer/admin tests. Do not create
production requests or send real emails without explicit authorization.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
