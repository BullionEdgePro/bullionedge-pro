# Put Luxx4less online with Vercel

About 10 minutes, all in your browser, while signed in to Vercel (dezekielshop@gmail.com).

You'll end up with a live site at an address like `https://luxx4less.vercel.app`, with its own database. Emails start in **test mode**: they show up in a private on-site mailbox instead of real inboxes, until you connect an email service (step 7).

---

## 1. Make two random secrets

Open **https://generate-secret.vercel.app/32** and copy the result somewhere safe. Reload the page and copy a second one.

- Secret 1 → `BETTER_AUTH_SECRET` (protects everyone's sign-in)
- Secret 2 → `MAILBOX_KEY` (unlocks the test mailbox)

Don't share these.

## 2. Import the project

1. Go to **https://vercel.com/new**.
2. Under **Import Git Repository**, find **BullionEdgePro/bullionedge-pro** and click **Import**.
   - Not listed? Click **Adjust GitHub App Permissions** and allow Vercel to see that repository.
3. On the **Configure Project** screen:
   - **Project Name:** `luxx4less`
   - **Root Directory:** click **Edit**, choose **`luxx-vault`**, then **Continue**.
   - Leave Framework (Next.js) and the build settings as they are.
4. Open **Environment Variables** and add these five (name on the left, value on the right):

   | Name | Value |
   |---|---|
   | `BETTER_AUTH_SECRET` | Secret 1 |
   | `MAILBOX_KEY` | Secret 2 |
   | `EMAIL_PROVIDER` | `mock` |
   | `ALLOW_MOCK_EMAIL_IN_PRODUCTION` | `true` |
   | `HIBP_CHECK` | `on` |

5. Click **Deploy**. **This first attempt will fail**, which is expected: the site has no database yet, and Vercel tried the wrong branch. Continue below.

## 3. Add the database

1. Open your new **luxx4less** project in Vercel and go to the **Storage** tab.
2. Click **Create Database**, choose **Neon** (Postgres), and accept the defaults. Region: **Singapore** is closest to the Philippines.
3. When asked, connect it to the **luxx4less** project for **all environments**.

Vercel adds the database settings (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`) automatically.

## 4. Point Vercel at the right branch

The website code lives on the branch `claude/hopeful-gates-06x3c8`.

1. Project **Settings** → **Git** (in newer dashboards: **Settings → Environments → Production**).
2. Set **Production Branch** to `claude/hopeful-gates-06x3c8` and save.

## 5. Deploy

1. Go to the **Deployments** tab and click **Create Deployment** (or the ⋯ menu → **Redeploy** on the latest one).
2. Choose the branch `claude/hopeful-gates-06x3c8` and deploy.
3. Wait for **Ready** (2–4 minutes). The first build also sets up the database tables.

## 6. Try it

- Open your site: **https://luxx4less.vercel.app** (Vercel shows the exact address on the project page).
- Go to `/sign-up`, create an account.
- Open the test mailbox: `https://luxx4less.vercel.app/dev/mailbox?key=` followed by **Secret 2**. Click **Open the link in this email** to confirm.
- Sign in, then try **Security → Turn on two-step sign-in** with Google Authenticator or Microsoft Authenticator.

## 7. Real emails (when you're ready)

1. Create a free account at **https://resend.com** and add your domain (e.g. `luxx4less.ph`). Resend shows a few DNS records to add at your domain registrar.
2. Create an **API key** in Resend.
3. In Vercel → **Settings → Environment Variables**, change or add:
   - `EMAIL_PROVIDER` = `resend`
   - `RESEND_API_KEY` = your Resend key
   - `EMAIL_FROM` = `Luxx4less <no-reply@luxx4less.ph>`
   - delete `ALLOW_MOCK_EMAIL_IN_PRODUCTION` and `MAILBOX_KEY`
4. Redeploy. The test banner and mailbox disappear automatically.

## 8. Your own domain (optional)

Vercel → **Settings → Domains** → add `luxx4less.ph`, and follow the DNS steps. Then set `BETTER_AUTH_URL` = `https://luxx4less.ph` and redeploy, so sign-in links and passkeys use your domain.

---

### If something goes wrong

- **Build error mentioning `DATABASE_URL`:** the database isn't connected yet (step 3), or it isn't connected to all environments.
- **Build error "Invalid server environment":** a variable from step 2 is missing or misspelled. The error names it.
- **Sign-in says "invalid origin":** you opened a different address than the site's own. Use the address from the project page, or set `BETTER_AUTH_URL` (step 8).

Updates: every time new work is pushed to the branch, Vercel rebuilds the site automatically.
