# Nexora Gastro

Nexora Gastro is an operational digital system for restaurants. It connects the QR menu, table orders, waiter calls, staff workflow, admin controls, and archive into one product.

The product is positioned for larger restaurants where service work can become slow, unclear, or error-prone when orders and requests are handled only verbally. The goal is not only to show a digital menu, but to reduce unnecessary operational work for customers, waiters, and managers.

---

## Features

- QR-based customer menu
- Table-based ordering
- Waiter call system
- Staff dashboard for active orders and calls
- Admin panel for menu and system management
- Image upload for menu items
- Order status flow: `new → preparing → done → archived`
- Waiter call flow: `new → acknowledged → closed`
- Archive for completed orders and closed waiter calls
- Daily order activity and value overview
- Table zones for staff organization
- Staff PIN access with trusted device approval
- Supabase authentication for admin users
- Responsive layout for mobile, tablet, and desktop

---

## Project Structure

```text
nexora-gastro/
├── index.html
├── admin/
├── client/
├── staff/
├── status/
├── img/
└── supabase/
```

### Main Sections

- `client/`  
  Customer-facing QR menu and ordering page.

- `staff/`  
  Staff dashboard for managing orders and waiter calls.

- `admin/`  
  Manager/owner panel for menu management, staff devices, archive, and settings.

- `status/`  
  Order status page.

- `supabase/`  
  Database migrations and Edge Functions.

---

## Technology Stack

- HTML
- CSS
- JavaScript
- Supabase Database
- Supabase Auth
- Supabase Edge Functions
- Supabase Storage

---

## Supabase Edge Functions

The system uses these Supabase Edge Functions:

```text
admin-api
customer-api
upload-menu-image
```

Deploy them with:

```bash
supabase functions deploy admin-api
supabase functions deploy customer-api
supabase functions deploy upload-menu-image
```

If database migrations are needed:

```bash
supabase db push
```

---

## Local Development

Run the project locally from the project root:

```bash
python3 -m http.server 8001
```

Then open:

```text
http://localhost:8001/
http://localhost:8001/client/?table=1
http://localhost:8001/admin/
http://localhost:8001/staff/
```

On Windows, use:

```bash
python -m http.server 8001
```

---

## Deployment

The frontend can be deployed through Vercel, Netlify, or another static hosting provider.

Recommended flow:

```text
GitHub → Vercel → Live demo link
```

Example table links after deployment:

```text
https://your-domain.com/client/?table=1
https://your-domain.com/client/?table=2
https://your-domain.com/client/?table=3
```

Each table link can be converted into a QR code.

---

## Access Model

### Admin

Admin access is handled through Supabase Auth.  
Each admin user should have their own account.

Admin users must also exist in the `public.admin_users` table.

### Staff

Staff access works through:

```text
PIN + trusted device approval
```

A staff device must be approved by an admin before it can access the staff dashboard.

### Customer

Customers do not need accounts.  
They access the menu through a QR code linked to their table.

---

## Operational Flow

### Customer Order Flow

```text
Customer scans QR code
→ selects items
→ places order
→ staff sees order
→ staff updates status
→ order is archived when completed
```

### Waiter Call Flow

```text
Customer calls waiter
→ staff sees call
→ staff acknowledges call
→ staff closes call
```

---

## Notes

Nexora Gastro is designed as an operational restaurant service system.  
It is not a fiscal/POS replacement.

Fiscal receipts, tax handling, and official payment processing should remain inside the restaurant's existing POS or fiscal system.

---

## Status

Current version: Demo Release Candidate.

The system is ready for:

- live demonstration
- restaurant testing
- client presentation
- deployment to Vercel or similar hosting

Further improvements can include:

- advanced analytics
- POS integration
- automatic image compression
- custom domains per client
- multilingual menu support
- waiter-specific mobile views
