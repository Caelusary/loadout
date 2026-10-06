# Loadout

A marketplace for computer peripherals: independent shops list keyboards, mice, headsets, webcams, mousepads and accessories, customers buy from several shops in one checkout, and a platform admin approves sellers and moderates listings. Built with MongoDB, Express, React and Node (Group 3, C3A final project).

The fact that shapes the rest of the app: product specs are stored as structured data, not prose, so every spec a shopper cares about (switch type, layout, connectivity, resolution) is a filter, and the homepage renders each product as a 3D model built from those same specs.

## Running locally

Requires Node 20.19 or newer. No database to install: when `MONGODB_URI` is empty, the API starts an in-memory MongoDB replica set and seeds it (the first run downloads a MongoDB binary, about 780 MB).

```bash
npm install
```

```bash
npm run dev
```

The client runs on http://localhost:5173 and the API on http://localhost:5000 (Vite proxies `/api`). Data resets when the API stops.

To use a real database, copy `server/.env.example` to `server/.env`, set `MONGODB_URI` to an Atlas connection string, then seed it. Seeding deletes everything in that database first, so for anything that isn't on this machine it asks for an explicit flag:

```bash
npm run seed -- --wipe-remote
```

Seed a live database once, then take its connection string out of your local `.env` so nobody reseeds it by accident.

### Demo accounts

All use the password `password123`.

| Email | Role |
|---|---|
| `owner@loadout.test` | Owner: an admin who also makes, removes and deactivates admins |
| `admin@loadout.test` | Admin (can't change other admins or the owner) |
| `northpaw@loadout.test` | Seller (Northpaw Keys) |
| `glide@loadout.test` | Seller (Glide Lab) |
| `hush@loadout.test` | Seller (Hush Audio) |
| `lumen@loadout.test` | Seller (Lumen Desk) |
| `coilworks@loadout.test` | Customer with a pending seller application |
| `mika@loadout.test`, `paolo@loadout.test`, `lea@loadout.test` | Customers with order history |

Discount codes to try at checkout: `WELCOME200` (₱200 off from ₱1,500), `LOADOUT10` (10% off from ₱3,000), and `LAUNCH25` (expired, to see the error). Each customer can use a code once.

## Pages

| Route | Who | What it does |
|---|---|---|
| `/` | Everyone | Search bar with starter chips for the selected category, a 3D stage with one model per category, featured products, new arrivals, shops |
| `/compare` | Everyone | Up to four products of one category side by side, best value per row highlighted; the URL is shareable |
| `/loadout` | Everyone (adding to cart needs sign-in) | Loadout builder: pick one product per category, see the total, add everything to the cart |
| `/shop` | Everyone | Catalog; search, category, spec, brand, price and stock filters all live in the URL |
| `/p/:slug` | Everyone | Product detail with photo and 3D views, specs, and reviews |
| `/s/:slug` | Everyone | A seller's storefront |
| `/cart` | Customers and sellers (guests are sent to sign in) | Cart grouped by shop, with per-shop shipping. Saved on the account, so it's the same on every device |
| `/checkout`, `/order-confirmed/:checkoutId` | Signed in | Address, simulated payment, discount code, and the orders the checkout created |
| `/orders/:id` | The order's customer, its seller, or an admin | Order detail with a timestamped status timeline; cancel, advance, or confirm receipt depending on who is looking; returns within 7 days of delivery |
| `/account`, `/account/orders`, `/account/wishlist`, `/account/sell` | Signed in | Profile, password and deleting your account (plus `/forgot-password` and `/reset-password` for a forgotten one), order history, saved products, seller application (again a week after a decline) |
| `/seller/*` | Approved sellers | Dashboard, product management with image uploads (backgrounds removed in the browser) and `.glb` models, order queue, returns |
| `/admin/*` | Admin (each area needs the owner's permission) | Platform dashboard, seller approvals, product moderation, all orders, disputed returns, discount codes, users (including sending password reset emails), and the activity log |

Every signed-in page has a notification bell for order and shop updates. On phones the site switches to a bottom tab bar (Home, Shop, Build, Saved, Cart, Account) instead of shrinking the desktop layout.

The API has 66 routes under `/api`, one router per feature in [server/src/features/](server/src/features/); each route lists its access guards inline.

## Required concepts, where each one lives

**React frontend.** [client/](client/) is a Vite + React 19 app. Routes are declared in [App.jsx](client/src/App.jsx); server data goes through TanStack Query.

**Node/Express REST API.** [server/src/app.js](server/src/app.js) mounts one router per feature under [server/src/features/](server/src/features/). Every error leaves through [errorHandler](server/src/middleware/error.js#L43) in one shape: `{ error: { code, message, fields? } }`.

**MongoDB with Mongoose.** Eight models in [server/src/models/](server/src/models/): User (with a wishlist, a cart and its signed-in sessions), Product, Order (with a status history, discount and refund fields), Review, Coupon, Notification, ReturnRequest and ActivityLog, plus an embedded address schema.

**Register and log in, UI follows auth state.** Passwords are hashed with bcrypt in a pre-save hook. The session is a JWT in an httpOnly cookie that holds only the user id and a session id; the role is re-read from the database on every request ([auth.js](server/src/middleware/auth.js)), so an approval or deactivation applies immediately. Each device's session is listed on the account, so signing out ends it on the server too, and a password change signs out every other device. The navbar, the checkout gate and the "Sign in to review" prompt all read the session from [AuthProvider](client/src/providers/AuthProvider.jsx); protected pages use [RequireAuth](client/src/components/layout/guards.jsx#L29).

**CRUD.**

| | Customer | Seller | Admin |
|---|---|---|---|
| Create | Order, review, seller application, wishlist item | Product | Discount code |
| Read | Catalog, own orders | Own orders, sales stats | All orders, users, sellers, platform stats |
| Update | Profile, password, own review, notification read state | Own product, order status | Approve or suspend seller, unlist or feature product, turn a discount code on or off, deactivate user |
| Delete | Cancel own order, delete own review, remove wishlist item | Delete or archive own product | Delete user, remove any review |

**Roles and ownership.** Three roles: customer, seller, admin, plus one owner: an admin who makes and removes admins and picks which areas (users, sellers, products, orders, discount codes) each one manages. [requireRole](server/src/middleware/auth.js#L78), [requireArea](server/src/middleware/auth.js#L89) and [requireApprovedSeller](server/src/middleware/auth.js#L99) guard routes, and every controller that loads a record by id filters by owner, returning 404 rather than 403 so ids can't be probed. Write controllers copy fields through [pick](server/src/lib/request.js#L4), so a request can't set `role`, `seller` or `ratingAvg`.

**Validation on both sides.** Every form uses React Hook Form with a Zod schema that mirrors the Mongoose rules, for example [the product form](client/src/features/seller/ProductFormPage.jsx#L50). The Mongoose validators are the final check, and server field errors are mapped back onto the form inputs by [applyServerErrors](client/src/lib/api.js#L67).

## Notable decisions

**Discount codes are priced twice, both times on the server.** The checkout preview and the order itself share [priceCoupon](server/src/features/coupons/service.js), so they can't disagree. The use is claimed with a conditional update inside the checkout transaction, so the last use of a limited code can't be taken twice and a rejected code rolls back the stock reservation. The discount is split across the per-shop orders so each shop's order shows its real share.

**One checkout, one order per shop.** Each shop ships its own items, so [createOrders](server/src/features/orders/controller.js#L30) splits the cart by seller inside a MongoDB transaction. The client sends only product ids and quantities; prices come from the database. Stock is reserved with a conditional `$inc` (`stock >= qty`), so two buyers can't both get the last unit, and one failed item rolls back the whole checkout. Transactions need a replica set, which is why local development runs an in-memory replica set rather than a standalone `mongod`.

**Status changes can't race.** [cancelOrder](server/src/features/orders/controller.js#L178) and [advanceOrder](server/src/features/orders/controller.js#L233) update with a status condition in the filter, so a cancel and a "mark shipped" arriving together can't both succeed, and a cancel can't restock twice.

**Every admin action is logged and undoable.** Each one writes an [ActivityLog](server/src/models/ActivityLog.js) entry in the same transaction. The owner can [undo](server/src/features/activity/service.js#L198) it, but only if nothing has changed since; an admin's order cancel is logged but final, because the stock may already have sold again.

**Archive instead of delete.** A product that appears in any order is unlisted rather than deleted, because orders keep a snapshot of the name and price but still reference it. A product an admin unlisted can only be relisted by an admin.

**Real models, with a generated fallback.** Every seed product has a Sketchfab model (see Credits), and its three catalog photos in [client/public/products/](client/public/products/) are rendered from that model by `npm run shots`, so the photos and the 3D view always match. Sellers can upload their own `.glb`; products without one get a stand-in from [ProceduralModel](client/src/features/home/models/procedural.jsx#L440), built from the product's data (a keyboard's key grid follows its `layout` spec).

**The hero is a category picker, not a product carousel.** [CategoryHero](client/src/features/home/CategoryHero.jsx) shows one 3D model per category on a single WebGL canvas, fitted so every model fills the same frame, under a search bar whose starter chips change with the selected category. Search matches every typed word against names, brands, descriptions, categories (including words like "mice" or "headphones") and spec values. Models load one at a time, and each one's textures and shaders are prepared off the main thread before it shows, so the first visit doesn't freeze. The canvas stops rendering when it's off screen or the tab is hidden, three.js loads only on pages that need it, and browsers without WebGL 2 get a still product shot instead.

**Seller photos get their backgrounds removed in the browser.** [CutoutReview](client/src/features/seller/CutoutReview.jsx) runs `@imgly/background-removal` on each picked photo and shows it next to the original; the seller picks which one uploads. Doing it client-side needs no API key and adds no server load, so every listing can have a clean cutout like the seed renders.

## Tests

```bash
npm test
```

The server suite (101 tests, [server/test/](server/test/)) runs against a seeded in-memory replica set and covers the rules that would be expensive to break:
- registration ignoring a submitted `role`; login giving the same answer for a wrong password and an unknown email
- checkout pricing, splitting and stock reservation, and two shoppers racing for the last unit
- a checkout still reporting success when saving the address afterwards fails, so a retry can't buy twice
- an out-of-stock item rolling back the whole checkout
- order privacy between customers and shops
- forward-only status changes
- cancel rules and restocking
- verified-buyer reviews and rating updates
- seller ownership of products
- rejection of foreign asset URLs, and uploads checked by their bytes, so a renamed HTML file can't pass as an image
- suspension unlisting a seller's products
- admins unable to change the owner or hand out admin; the owner making, deactivating and removing admins
- the activity log: every admin action recorded, undo for the owner only (including restoring a deleted account), and a refused undo once the thing has changed again
- sessions ending on sign-out, password change or reset, and deactivation; one-time, expiring reset links that two simultaneous requests can't both use; the 72-byte password limit bcrypt actually reads; the password check on email changes; closing an account with open orders or returns
- returns: the 7-day window, allowed reasons, quantities across partial returns, a double-submitted request, refunds never above what was paid, escalation, and restocking once
- suspending a shop cancelling its unshipped orders, the undo notices, confirming receipt and the 7-day auto-complete
- discount codes: validation, one use per customer, a race for the last use, the preview refusing carts checkout would refuse, and the use coming back when a checkout is cancelled
- seller applications and account deletion rules
- the cart: stored on the account, every checkout rule applied when adding, and checkout removing only what was bought
- search matching words across names, categories and specs, and unknown sort names
- the health check failing when the database is down

The client suite (22 tests) covers the cart reducer, peso parsing and formatting, how API errors map onto form fields, and that the client's address rules and shipping fee match the server's, so checkout can't show a total the server won't charge.

[CI](.github/workflows/ci.yml) runs lint, both suites and the client build on every push and pull request to `main`.

```bash
npm run lint
```

## Known limitations

- Payment is simulated. "Card (simulated)" collects no card details, and nothing is charged.
- The seeded product images are renders of Sketchfab models, not photos. Seller uploads go to Cloudinary when its keys are set, otherwise to `server/uploads` on the API's disk, which does not persist on hosts like Render's free tier.
- Background removal downloads its model (about 40 MB) from IMG.LY's CDN the first time a seller uses it, and takes a few seconds per photo. The library is AGPL-3.0, which is fine for this coursework but would need a commercial licence or a swap before any closed-source use.
- The only email is the password reset link, sent through Brevo. There are no order confirmations or seller approval emails; those arrive as in-app notifications.
- Deployment config is in place but unverified. [render.yaml](render.yaml) describes the API service, with `/api/health` (which fails when MongoDB is disconnected) as its health check, and the server closes connections cleanly on Render's shutdown signal. `client/vercel.json` still rewrites `/api` to a placeholder Render URL that has to be replaced. The login rate limiter keys on client IP, so check `TRUST_PROXY` against the real proxy chain after deploying. TODO: deploy and confirm.
- Stats bucket days in `Asia/Manila`, and the currency is fixed to PHP.

## Credits

Every seed product's 3D model, and the product photos rendered from it, comes from Sketchfab under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Each was turned to face the camera, compressed (meshopt geometry, WebP textures at 512 px), and in one case trimmed (the Ledger's cable). The homepage's category showcase reuses these files. They live in [client/public/products/models/](client/public/products/models/).

| Product | Model | Author |
|---|---|---|
| Northpaw Aster 75 Wireless | [VortexSeries Mechanical Keyboard GT-8 / NJ80](https://sketchfab.com/3d-models/vortexseries-mechanical-keyboard-gt-8-nj80-02d16e9dae72419aa24ec6788318f92b) | [Rendy K](https://sketchfab.com/RendyK) |
| Northpaw Tern 65 | [65% Keyboard](https://sketchfab.com/3d-models/65-keyboard-58bb64ea94524b0ca220ef0fb5f6120e) | [RollerXD](https://sketchfab.com/rollerxd3d) |
| Northpaw Halden TKL | [Logicool G913 TKL Gaming Keyboard](https://sketchfab.com/3d-models/logicool-g913-tkl-gaming-keyboard-8e2af3401b66418e8b0f00a3f69495fe) | [21CCG0006](https://sketchfab.com/21CCG0006) |
| Northpaw Pip 60 | [Custom - Mechanical Keyboard](https://sketchfab.com/3d-models/custom-mechanical-keyboard-90d61eec0c484332ab562c5f4eda6f52) | [unknown.fbx](https://sketchfab.com/ibrahimtaha.fbx) |
| Northpaw Ledger Full | [Mechanical keyboard](https://sketchfab.com/3d-models/mechanical-keyboard-1ba4055c33674567b51b783701ed05ce) | [FelikinRuslan](https://sketchfab.com/FelikinRuslan) |
| Northpaw Sable 65 Wireless | [white to cyan shade 60% keyboard](https://sketchfab.com/3d-models/white-to-cyan-shade-60-keyboard-b210156b0a86460db63d4acbb7ee3e33) | [powder](https://sketchfab.com/powder12) |
| Northpaw Coiled USB-C Cable | [Coiled Keyboard Cable](https://sketchfab.com/3d-models/coiled-keyboard-cable-f0f765ea810840858235ba1b900c0d52) (recoloured violet) | [lapeche](https://sketchfab.com/Emily.Fodden) |
| Northpaw Numpad | [Numpad](https://sketchfab.com/3d-models/numpad-cedbec5131c044aebc82119510deaf3f) (laid flat) | [yuriwatt](https://sketchfab.com/yuriwatt) |
| Glide Vane Pro | [Computer Mouse (low-poly)](https://sketchfab.com/3d-models/computer-mouse-low-poly-95eb7d0363bb4db79bd50168280ea1c7) | [LagzDesign](https://sketchfab.com/LagzDesign) |
| Glide Vane Mini | [PC wireless mouse](https://sketchfab.com/3d-models/pc-wireless-mouse-df32a4319f304bc29330bf8c53c4adde) (recoloured) | [che_be](https://sketchfab.com/che_be) |
| Glide Orbit Ergo | [Stealth Series: Ergonomic Wireless Mouse Concept](https://sketchfab.com/3d-models/stealth-series-ergonomic-wireless-mouse-concept-be00cd1edd364f30a0a2da8c0511d5e0) | [yazz88](https://sketchfab.com/yazz88) |
| Glide Flick Wired | [Ice Claw mouse](https://sketchfab.com/3d-models/ice-claw-mouse-43de4d030ae94667bd8b8a478dd371ac) | [dmitriy7776661111](https://sketchfab.com/dmitriy7776661111) |
| Glide Drift Travel | [computer mouse](https://sketchfab.com/3d-models/computer-mouse-bd571d8034b040f2834da88173b5739e) | [ChoboiAssets](https://sketchfab.com/alsoliman905) |
| Glide Glow Pad 49 | [RGB Gaming Mousepad](https://sketchfab.com/3d-models/rgb-gaming-mousepad-331317c7d6bf4555b4645dbcabdf7e40) | [poopdeckpercy](https://sketchfab.com/poopdeckpercy) |
| Glide Cloth XL | [mouse pad (keyboard pad)](https://sketchfab.com/3d-models/mouse-pad-keyboard-pad-7690f727d87847aaa737c8110c8e6531) (printed artwork added) | [ｍｆｋ](https://sketchfab.com/mfkffzl) |
| Glide Control Pad M | [Damascus Mousepad](https://sketchfab.com/3d-models/damascus-mousepad-42dc83c9a40a49bfaaccd0ea50762f85) | [supahot](https://sketchfab.com/supahot) |
| Hush Veil Wireless | [Headphones Free Model by Oscar Creative](https://sketchfab.com/3d-models/headphones-free-model-by-oscar-creative-db92168ca39541939d0110e64a37f92e) | [OSCAR CREATIVO](https://sketchfab.com/oscar_creativo) |
| Hush Studio Open | [Studio Headphones](https://sketchfab.com/3d-models/studio-headphones-2f04830fbf884632a89445db0d170ba8) | [crow](https://sketchfab.com/crow.bite) |
| Hush Lite Headset | [Wireless Headphones](https://sketchfab.com/3d-models/wireless-headphones-c5271140dfb442af9f8c45e1087d769f) | [ahtusik](https://sketchfab.com/ahtusik) |
| Hush Frame 4K | [Web Camera](https://sketchfab.com/3d-models/web-camera-b6461ec1520748179686b87bef7089e9) | [darklord3d](https://sketchfab.com/erebus3d) |
| Hush Frame 1080 | [Webcam](https://sketchfab.com/3d-models/webcam-6eb2066a95e04b87a322ef441933873c) | [Tus](https://sketchfab.com/Tus_R) |
| Hush Frame Lite | [Webcam](https://sketchfab.com/3d-models/webcam-89d6eaf640c64d9aa6549e0b3fa54415) (recoloured) | [7124115](https://sketchfab.com/7124115) |
| Northpaw Ridge 75 | [Red Mechanical Keyboard Monokei x TGR Tomo](https://sketchfab.com/3d-models/red-mechanical-keyboard-monokei-x-tgr-tomo-3f647039ee88471ba1ecbdee7cae65c3) | [RendyK](https://sketchfab.com/RendyK) |
| Northpaw Cloud Wrist Rest | Modelled for this project | Loadout team |
| Glide Vane Air | [Wireless Mouse](https://sketchfab.com/3d-models/wireless-mouse-98c12fa57e674408b7694d3b2e7f3a6f) (turned to face front) | [Maxime66410](https://sketchfab.com/Maxime66410) |
| Glide Speed Pad L | [Mouse pad](https://sketchfab.com/3d-models/mouse-pad-d081ba4ce87d4088abe5dbb1b6ed8f55) (printed artwork added) | [oxygen3d](https://sketchfab.com/oxygen3d) |
| Hush Pulse Wireless | [Wireless Gaming Headset](https://sketchfab.com/3d-models/wireless-gaming-headset-3075896c0ab84e23a6f085c300c33805) | [DatSketch](https://sketchfab.com/DatSketch) |
| Hush Core Wired | [Red Dragon Headset](https://sketchfab.com/3d-models/red-dragon-headset-fc19b5826616472281c1717a71bd3cd8) (logo removed, turned to face front) | [abgreiver](https://sketchfab.com/abgreiver) |
| Hush Frame Pro 1440 | [Insta360 Link 2 4K AI Webcam](https://sketchfab.com/3d-models/insta360-link-2-4k-ai-webcam-b6e5aa185a95459a923acabaf4e48005) (logos removed, simplified) | [bswlife](https://sketchfab.com/bswlife) |
| Lumen Halo Light Bar | [BenQ Screenbar Halo](https://sketchfab.com/3d-models/benq-screenbar-halo-af29991f303748b4a49b06e6e1e07baa) (recoloured, LEDs lit) | [Virtuon](https://sketchfab.com/Virtuon) |
| Lumen Perch Headphone Stand | [Headphone stand](https://sketchfab.com/3d-models/headphone-stand-06981a925b4245938a905b1921c44b26) | [raxar_](https://sketchfab.com/raxar_) |
| Lumen Duo Felt Desk Mats | [(Free) Desk Mat Set - Pink and Blue](https://sketchfab.com/3d-models/free-desk-mat-set-pink-and-blue-11d247203dc54d2f9498facba5735d71) (felt texture and mark replaced) | [PolyDavid](https://sketchfab.com/PolyDavid) |
| Lumen Stream Cam | [Logitech Webcam](https://sketchfab.com/3d-models/logitech-webcam-0523fbf537cd4ea4a41e96b8293312ac) (lettering removed) | [qoodrat](https://sketchfab.com/qoodrat) |
