# Ganduvaru Maldives E-commerce

Luxury, responsive e-commerce storefront for the Ganduvaru retail brands in Maldives.

## Storefronts represented

- Ganduvaru Mobiles
- Ganduvaru Electronics
- Dr.Rashel Maldives
- Zaara Beauty Care

The initial catalog and contact details were assembled from the public Facebook pages supplied for the project and current public product posts. All catalog content can be changed later from the Admin page.

## Features

- Luxury dark / champagne-gold responsive design
- Mobile, tablet and desktop layouts
- Multiple store / brand hubs
- Search, category filters and sorting
- Product catalog
- Shopping cart with quantity controls
- Customer Name + Mobile login flow
- OTP adapter with demo mode for testing
- Checkout and WhatsApp order handoff
- Admin control center
  - Edit page content
  - Add / remove navigation tabs
  - Add / remove products
  - Edit stores and contact details
  - Publish updates directly to GitHub
- GitHub Pages deployment workflow
- No card details are stored or collected

## Website URLs

After GitHub Pages is enabled for this repository:

- Storefront: https://hashansoysa92-commits.github.io/Ganduvaru-Maldives/
- Admin: https://hashansoysa92-commits.github.io/Ganduvaru-Maldives/admin.html

## Admin login

The Admin page uses GitHub itself as the content-management backend.

Create a **fine-grained GitHub Personal Access Token** restricted to this repository only, with:

- Repository access: `Ganduvaru-Maldives`
- Repository permission: **Contents — Read and write**

Paste the token into the Admin login screen.

Security notes:
- The token is never committed into the repository.
- The current Admin implementation stores the token only in browser `sessionStorage`.
- Closing the browser/tab session clears it.
- Never add a GitHub token to `config.js` or any public file.

## Product data

Main catalog file:

`data/catalog.json`

It controls:
- Site text
- Navigation tabs
- Store information
- Categories
- Products
- Store contact details
- WhatsApp order number

The Admin page writes changes back to that file through the GitHub Contents API.

## OTP configuration

`config.js` contains:

```js
otpRequestUrl: "",
otpVerifyUrl: "",
demoOtpAllowed: true
```

With the current settings the website uses **Demo OTP mode** so the complete customer flow can be tested without paying for SMS.

For production SMS verification:
1. Deploy an OTP backend / Edge Function.
2. Connect a supported SMS provider.
3. Put its request and verification endpoints into `otpRequestUrl` and `otpVerifyUrl`.
4. Set `demoOtpAllowed: false`.

Real SMS delivery is not included in GitHub Pages itself and normally has a per-message provider cost.

## Checkout / payments

The current checkout:
- Requires verified customer session
- Collects delivery/pickup details
- Offers Pay on confirmation / Bank transfer / Store pickup
- Sends the complete order to Ganduvaru via WhatsApp for stock and payment confirmation

No payment card data is handled in the browser.

A direct online card-payment gateway can be added later after merchant gateway credentials and payment-provider requirements are available.

## GitHub Pages

A deployment workflow is included at:

`.github/workflows/pages.yml`

One-time repository setting:
1. Open **Settings → Pages**
2. Under **Build and deployment**, choose **GitHub Actions**
3. Run/re-run the `Deploy Ganduvaru Pages` workflow if required

Every later push to `main` will redeploy automatically.

## Main files

- `index.html` — storefront
- `styles.css` — responsive luxury design
- `app.js` — products, cart, login, OTP adapter, checkout
- `admin.html` — admin interface
- `admin.js` — GitHub-backed content management
- `config.js` — runtime configuration
- `data/catalog.json` — editable catalog/content
- `assets/logo.svg` — site monogram
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Free-first architecture

Current infrastructure uses:
- GitHub repository — source control
- GitHub Pages — static hosting
- Browser local/session storage — cart and customer session
- GitHub Contents API — admin content management
- WhatsApp order handoff — checkout confirmation

This keeps the base website hosting and content-management architecture free of a dedicated paid web server.

## Important production checklist

Before advertising the site for live orders:
- Replace Demo OTP with a real SMS provider
- Confirm the final Ganduvaru order WhatsApp number
- Verify every product price and stock level
- Add official product photography
- Add delivery / returns / warranty / privacy terms
- Add a merchant payment gateway only if online card payments are required
