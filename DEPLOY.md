# Deploying luizkim.com

The site is static. A push to `main` runs `.github/workflows/deploy.yml`, which
scans the history for secrets, builds `dist/` with `scripts/build.py`, and
uploads it to Cloudflare Pages. Nothing else touches production.

`scripts/build.py` decides what goes public. Source material (the Blender file,
the export script, this file, the workflow) stays in the repository. It also
writes `dist/_headers`, including a Content-Security-Policy whose inline-script
hashes are computed from the pages, so editing an inline `<script>` needs no
other change.

Run it locally with `python3 scripts/build.py` and open `dist/index.html`.

## One-time setup

Do these in order; the site stays up throughout.

### 1. Accounts

- GitHub and Cloudflare: add a passkey or hardware key as the second factor,
  then remove SMS as a fallback. For a static site, account takeover is the
  realistic attack; everything below is secondary to this.

### 2. Cloudflare

1. Add `luizkim.com` as a site on Cloudflare (free plan) if it is not there.
   Leave the DNS records as they are for now.
2. Workers & Pages -> Create -> Pages -> **Upload assets** (not "connect to
   Git"). Name the project `luizkim-com`. Upload anything; the workflow replaces
   it on the first run.
3. Profile -> API Tokens -> Create Token -> Custom token:
   - Permissions: `Account` / `Cloudflare Pages` / `Edit`. Nothing else.
   - Account resources: your account only.
   - Copy the token once; it is not shown again.
4. Note the Account ID (right column of the account home page).

### 3. GitHub

1. Settings -> Secrets and variables -> Actions -> New repository secret:
   - `CLOUDFLARE_API_TOKEN`: the token from step 2.3
   - `CLOUDFLARE_ACCOUNT_ID`: the id from step 2.4
2. Settings -> Environments -> New environment `production`. Leave reviewers
   off; the deploy is meant to run on its own.
3. Settings -> Actions -> General:
   - Actions permissions: *Allow owner, and select non-owner, actions*, and list
     `actions/checkout@*`, `cloudflare/wrangler-action@*`, `gitleaks/gitleaks-action@*`.
   - Workflow permissions: *Read repository contents and packages*.
4. Merge this branch. Watch the Actions tab: the run should end with a
   `luizkim-com.pages.dev` URL. Open it and click around.
   - If the scan step asks for a licence, it is because the repository is under
     an organisation. Personal accounts need none.

### 4. Domain

1. Cloudflare -> the Pages project -> Custom domains -> add `luizkim.com` and
   `www.luizkim.com`. Cloudflare rewrites the DNS records for you when the zone
   is on Cloudflare; `www` redirects to the apex.
2. Zone -> SSL/TLS: mode **Full (strict)**; Edge Certificates: *Always Use
   HTTPS* on, *Minimum TLS Version* 1.2, *HSTS* on (max-age 12 months).
3. Zone -> DNS -> Settings: enable **DNSSEC** and add the DS record at the
   registrar if the domain is registered elsewhere.
4. Delete any leftover DNS records that still point at GitHub Pages
   (`185.199.108-111.153` A records, `luizfelipekim.github.io` CNAME).

### 5. Retire GitHub Pages

1. Repository Settings -> Pages -> Source: **None**.
2. Delete the `CNAME` file from the repository. It was for GitHub Pages only.
3. Settings -> General -> Danger Zone -> **Change visibility -> Private**.
4. Settings -> Branches -> add a ruleset for `main`: require a pull request,
   block force pushes, require the `Secret scan` check to pass.

## Afterwards

- Rotate `CLOUDFLARE_API_TOKEN` once a year, or at once if a workflow log ever
  looks wrong. Create a new token, replace the secret, delete the old token.
- Dependabot opens a PR when a pinned action has a new release. Merge it like
  any other change.
- If a deploy ever publishes something it should not, roll back from the Pages
  dashboard (Deployments -> previous deployment -> Rollback), then fix `main`.
