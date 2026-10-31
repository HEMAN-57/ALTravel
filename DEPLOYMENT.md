# TripSync Production Deployment Guide ($0 Free Cloud Architecture)

This guide documents the manual deployment procedure for TripSync on **Render** and **Neon PostgreSQL** under the free tier budget ($0.00).

---

## Architecture Overview

| Component | Service Provider | Runtime / Plan | Region | Free Quota |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Render Static Site | Static Site | Singapore | 100 GB/month bandwidth |
| **Backend** | Render Web Service | Docker (Java 21 JRE) | Singapore | 512 MB RAM, 0.1 CPU, spun down after inactivity |
| **Database** | Neon Serverless Postgres | PostgreSQL 16 Free | Singapore / Asia | 0.5 GiB storage, direct connection |

---

## Step 1: Provision Neon PostgreSQL Free Tier

1. Sign in to [Neon Console](https://console.neon.tech/).
2. Create a new project:
   - **Project Name:** `tripsync`
   - **Database Name:** `neondb`
   - **Region:** `ap-southeast-1` (Singapore) or closest Asian region.
   - **Branch:** `production` (or default `main` renamed to `production`).
3. In the Neon Dashboard, go to **Connection Details**:
   - Select **Direct connection** (do **NOT** select "Pooled connection" because Flyway migration locks and Spring DDL validation require direct transactional PostgreSQL connections).
4. Note your connection details (password is shown upon creation):
   - Host (e.g. `ep-quiet-star-123456.ap-southeast-1.neon.tech`)
   - Database (`neondb`)
   - User (e.g. `neondb_owner`)
   - Password (`<YOUR_NEON_PASSWORD>`)
5. Construct the JDBC connection URL:
   ```text
   jdbc:postgresql://<neon-host>:5432/neondb?sslmode=require
   ```
   > **Important:** Neon mandates SSL encryption (TLS 1.2+). The parameter `sslmode=require` is required for Spring Boot Hikari pool connections.

---

## Step 2: Deploy Backend Web Service (Render Docker)

1. Sign in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository: `https://github.com/HEMAN-57/TripSync` (or selected remote).
4. Configure the Web Service settings:
   - **Name:** `tripsync-backend`
   - **Language / Runtime:** `Docker`
   - **Branch:** `main`
   - **Region:** `Singapore`
   - **Root Directory:** *(leave blank)*
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Build Context:** `.`
   - **Instance Type:** `Free` (512 MB RAM, 0.1 CPU)
   - **Health Check Path:** `/actuator/health`
5. Configure Environment Variables in the **Environment** tab:

   | Key | Example / Format | Purpose |
   | :--- | :--- | :--- |
   | `SPRING_PROFILES_ACTIVE` | `prod` | Activates production profile conventions |
   | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<neon-host>:5432/neondb?sslmode=require` | Direct Neon PostgreSQL connection URL with mandatory SSL |
   | `SPRING_DATASOURCE_USERNAME` | `<neon-db-user>` | Neon database user name |
   | `SPRING_DATASOURCE_PASSWORD` | `<neon-db-password>` | Neon database user password |
   | `JWT_SECRET` | *(64+ character random hex or base64 string)* | Cryptographic HMAC-SHA256 secret key for signing and validating session tokens |
   | `CORS_ALLOWED_ORIGINS` | `https://*.onrender.com,https://<your-frontend>.onrender.com` | Allowed frontend origin for CORS browser protection (supports wildcards e.g. `https://*.onrender.com`) |

   *(Note: Render automatically injects the `PORT` environment variable, which our entrypoint dynamically binds to Spring Boot).*

6. Click **Create Web Service**.
7. Wait for the build to complete. The logs should display:
   ```text
   Successfully applied 4 migrations to schema "public", now at version v4
   Tomcat started on port 8080 (http) with context path '/'
   Started AltravelBackendApplication in ...
   ```
8. Copy the backend service URL (e.g. `https://tripsync-backend.onrender.com`). Verify health:
   ```bash
   curl -i https://tripsync-backend.onrender.com/actuator/health
   # Expected: {"status":"UP","components":{"db":{"status":"UP"...}}}
   ```

---

## Step 3: Deploy Frontend (Render Static Site)

1. In Render Dashboard, click **New +** > **Static Site**.
2. Connect the same GitHub repository: `https://github.com/HEMAN-57/TripSync`.
3. Configure the Static Site settings:
   - **Name:** `tripsync-frontend`
   - **Branch:** `main`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
4. Configure Redirects / Rewrites in the **Redirects/Rewrites** tab:
   - **Type:** `Rewrite`
   - **Source:** `/*`
   - **Destination:** `/index.html`
   > **Note:** This single-page application (SPA) rewrite rule ensures deep routing links refresh cleanly without 404 errors.
5. Configure Environment Variables in the **Environment** tab:

   | Key | Value | Purpose |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://tripsync-backend.onrender.com/api` | Base API URL pointing to the deployed backend service |

6. Click **Create Static Site**.
7. Once deployed, note your static site URL (e.g. `https://tripsync-frontend.onrender.com`).

---

## Step 4: Finalize CORS Configuration

1. Return to the `tripsync-backend` Web Service on Render.
2. Under **Environment**, update `CORS_ALLOWED_ORIGINS` to include your exact static site URL and/or Render wildcard pattern:
   ```text
   CORS_ALLOWED_ORIGINS=https://tripsync-frontend-8h9q.onrender.com,https://*.onrender.com
   ```
   > **Note:** Render assigns a randomized subdomain suffix (e.g. `tripsync-frontend-8h9q.onrender.com`). Setting `https://*.onrender.com` or your exact assigned domain ensures browser requests are not blocked by CORS with HTTP 403 `Invalid CORS request`.
3. Save changes. Render will perform a quick rolling redeploy.

---

## Understanding Free Tier Cold Starts

- **Render Free Web Services** enter sleep mode after 15 minutes of inactivity.
- **Neon Free Postgres** suspends compute after 5 minutes of inactivity.
- On cold wake-up, the first HTTP request will experience a latency of 20–40 seconds while Render spins up the container and Neon restores the PostgreSQL instance.
- **TripSync UI Resilience:** The frontend proactively probes `/actuator/health` upon application load to trigger warm-up, and presents animated wake-up guidance during authentication attempts rather than failing immediately.
