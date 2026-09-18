# NMP Support Ticketing System

Three-portal support ticketing system for the National Museum of the Philippines.

## Portals

| Portal | URL | Role | Purpose |
|--------|-----|------|---------|
| **Admin** | http://on-prem.x-dcb.net:5173/admin | admin | Build and publish request forms |
| **Client** | http://on-prem.x-dcb.net:5173/client | user | Submit requests with uploaded documents |
| **Records** | http://on-prem.x-dcb.net:5173/records | record_management | Review submissions, set recommendation |

## Flow

1. **Admin** builds a form and clicks **Save & publish** → form goes live.
2. **Client** signs in, fills the live form, uploads a PDF → submission goes to Records as **For Review**.
3. **Record Admin** sees pending count in the notification bell, reviews the uploaded file, selects a **Recommendation**, and clicks **Submit**.

## Quick start

```bash
bun run setup
bun run start
```

Requires MySQL running locally and [Bun](https://bun.sh).

## Accounts

Sign in with your **museum org username/email** (MySQL `users`). Requestor details auto-fill from PAMANA (`staffs` / `staffinformations`) when the account is linked.

Demo `@nmp.gov.ph` seed accounts have been removed.

## Build

```bash
cd backend && bun run build
cd frontend && bun run build
```
