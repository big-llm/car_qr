# Smart Vehicle Contact Platform - Auth, User Flow & Profile System Plan

This plan defines the missing product layer needed to make the platform feel complete and production-ready:

- User registration and login
- Owner portal access
- Admin and user CRUD
- Activity history tracking
- Role-based access control

---

# 1. Core Problem

Current gaps:

- No clear registration flow
- No proper login entry point
- No structured profile lifecycle
- No complete user history view
- Weak role separation between scanner, owner, and admin

---

# 2. Final System Overview

## Roles

### Scanner

- Public user
- Uses OTP-based identity
- Gets a limited scanner session
- Can send alerts only through QR flow

### Vehicle Owner

- Registered user
- Manages profile and vehicles
- Receives and responds to alerts
- Can view alert history

### Admin

- Full system control
- Manages users, vehicles, alerts, scanners, and abuse controls

---

# 3. Authentication Flow

## Entry Points

- Scanner: `/qr/:token`
- Owner login: `/login`
- Owner registration: `/register`
- Owner portal: `/owner`
- Admin login: `/admin`

## Owner Registration Flow

1. User enters phone number.
2. User verifies OTP through Firebase Auth.
3. Firestore user profile is created or completed.
4. User is assigned role `owner`.
5. User is redirected to owner dashboard.

## Owner Login Flow

1. User enters phone number.
2. User verifies OTP through Firebase Auth.
3. API validates the user profile and role.
4. User enters the owner dashboard.

## Session Strategy

- Use Firebase Auth for client identity.
- Use secure backend role checks for protected owner/admin APIs.
- Use scanner session cookies for QR scanner flow.

---

# 4. User Profile System

## User Fields

- `id`
- `name`
- `phoneNumber`
- `role`
- `status`
- `address`
- `whatsappNumber`
- `alternativeNumber`
- `createdAt`
- `updatedAt`

## Owner Features

- View profile
- Edit profile
- Phone number is read-only
- Status and role are backend-controlled

## Admin Features

- Create user
- Edit user
- Block or unblock user
- Assign owner role

---

# 5. Vehicle Ownership System

## Owner Features

- Add vehicle
- Edit vehicle
- Delete vehicle
- Regenerate QR token
- Download QR sticker

## Admin Features

- Create vehicle
- Assign vehicle to owner
- Reassign vehicle
- Delete vehicle
- Regenerate QR token

---

# 6. Activity History System

## Goal

Show trust, value, and traceability for owners and admins.

## Scanner History

Track:

- Alerts sent
- Time sent
- Vehicle reference
- Delivery and response status

## Owner History

Track:

- Alerts received
- Response status
- Time received
- Vehicle
- Location when available

## Admin History

Track:

- All alerts
- User activity
- Scanner activity
- Abuse windows and blocked numbers

---

# 7. History UI

## Owner Dashboard

- Recent alerts
- Last 1 year activity
- Filter by date
- Filter by vehicle
- Show response and resolved status

## Scanner

- Optional future view: previous requests for the current verified scanner identity

---

# 8. Data Retention

Requirement:

- Show the last 1 year of activity.

Implementation:

- Store alerts permanently for now.
- Add optional TTL cleanup after 1 year when retention policy is finalized.

---

# 9. Alert Lifecycle

1. `pending`: Alert created.
2. `delivered`: Owner notification was sent.
3. `pending_retry`: Notification failed and retry is queued.
4. `responded`: Owner responded.
5. `resolved`: Owner marked the issue resolved.
6. `expired`: Alert expired without response.
7. `failed`: Notification failed after retries.

---

# 10. Required API Surface

## Auth and Profile

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/register`

## Vehicles

- `POST /api/user/vehicles`
- `GET /api/user/vehicles`
- `PUT /api/user/vehicles/:vehicleId`
- `DELETE /api/user/vehicles/:vehicleId`
- `PUT /api/user/vehicles/:vehicleId/qr-regenerate`

## Alerts

- `GET /api/user/alerts`
- `GET /api/user/alerts/history`
- `PUT /api/user/alerts/:alertId/respond`

## Admin

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:userId`
- `PUT /api/admin/users/:userId/status`
- `GET /api/admin/alerts`

---

# 11. UI Flow

## Owner Portal

```text
Login/Register -> Dashboard -> Vehicles -> Alerts -> Profile
```

## Admin

```text
Login -> Dashboard -> Users -> Vehicles -> Alerts
```

---

# 12. Immediate Fixes

- Add `/login`.
- Add `/register`.
- Make profile a first-class owner page.
- Add owner vehicle CRUD.
- Add alert history filters.
- Enforce owner role checks on owner APIs.

---

# 13. Implementation Phases

## Phase 1

- Auth entry points
- Register/login mode
- User profile creation
- Role field

## Phase 2

- Owner vehicle CRUD
- Owner dashboard updates

## Phase 3

- Alert history filters
- Last 1 year activity view

## Phase 4

- Admin user edit flow
- Role management
- Abuse analytics expansion

---

# Final Outcome

After this work, the platform should have:

- Proper login and registration entry points
- Clean user lifecycle
- Full profile management
- Real owner vehicle management
- Useful alert history
- Stronger role-based access control

