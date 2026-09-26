# VB-G RAM G Order Library

A simple document library for VB-G RAM G orders/notifications.

## Features
- Category-wise document library
- Search by title, order number, subject/description and file name
- Viewer: View PDF + Download PDF
- Admin: Login, upload PDF, create category, delete document
- SQLite database
- PDF files stored on server

## Run locally
Requires Node.js 18+.

```bash
npm install
npm start
```

Open: http://localhost:3000

## IMPORTANT before public deployment
Set these environment variables:
- ADMIN_USER
- ADMIN_PASSWORD
- SESSION_SECRET
- NODE_ENV=production

Example:
ADMIN_USER=your_admin
ADMIN_PASSWORD=your_strong_password
SESSION_SECRET=use-a-long-random-secret
NODE_ENV=production

Do NOT publish the default password `ChangeMe123!`.

## Production note
This version is designed for a small office/team deployment. For multiple servers or high traffic, move sessions and uploaded PDFs to managed storage and use PostgreSQL/object storage.
