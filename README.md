# Elsewhere — Travel Assist

Elsewhere is a React destination-discovery site with a Node.js/Express API for account sign-up and sign-in. User accounts and server-side sessions are stored in PostgreSQL.

## Local development

1. Install Node.js 22 or newer and PostgreSQL.
2. Create a local database and user, then copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string.
3. Install dependencies with `npm install`.
4. Start the API and React development server together with `npm run dev`.

The API creates the required account, session, and rate-limit tables on startup. The Vite development server proxies `/api` requests to the API.

Sign-up requires a name, valid email address, and password of at least 12 characters. Passwords are hashed with scrypt. Session tokens are random, stored only as hashes in PostgreSQL, and sent to the browser in HttpOnly cookies.

## Build and run the container

Build the production image with `docker build -t travel-assist:latest .`. Run it with `DATABASE_URL` set to a PostgreSQL connection string. The API serves both the built React site and `/api` routes on port 3000.

## AKS

1. Push the built image to your Azure Container Registry and update the image in `k8s/app.yaml`.
2. Create a Kubernetes secret containing the PostgreSQL connection string:

   ```powershell
   kubectl create secret generic travel-assist-secrets --from-literal=database-url="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
   ```

3. Apply the workload with `kubectl apply -f k8s/app.yaml`.
4. Route HTTPS traffic from your ingress to the `travel-assist` service on port 80.

Keep database credentials in Kubernetes Secrets or a managed secret store, not in source control. Configure `TRUST_PROXY` to match the number of trusted ingress hops in your cluster.
