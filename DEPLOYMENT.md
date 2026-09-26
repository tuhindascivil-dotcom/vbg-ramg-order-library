# Live Deployment

Recommended: Render.

1. Create a GitHub repository and upload this project.
2. In Render, choose New -> Web Service and connect the repository.
3. Render detects the Dockerfile.
4. Add environment variables:
   ADMIN_USER = your admin username
   ADMIN_PASSWORD = a strong password
   SESSION_SECRET = a long random secret
5. Deploy.
6. Share the generated HTTPS URL with viewers.

IMPORTANT:
The current SQLite database and uploaded PDFs are stored on the server filesystem. On hosting platforms where the filesystem is ephemeral, use a persistent disk or migrate the database/PDF storage to managed PostgreSQL/object storage before production use.
