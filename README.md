# MFG developer toolkit

Build an independent browser game with MFG's MIT-licensed SDK, shared character and multiplayer libraries, and trusted preview uploader. No access to MFG's private repository is required. Third-party dependencies and character models retain their own licenses and notices; Universal, Pocket and Hero models carry CC0 provenance. The Sprout 3D model is excluded.

## Start a game

Use Node 24.19.0 and pnpm 12.4.1. Clone this repository, copy either `templates/external-cards` or `templates/external-canvas` into your own game repository, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
```

Copy the complete template, including `.github`, `vendor`, `LICENSE`, `pnpm-workspace.yaml` and `pnpm-lock.yaml`. Keep the bundled local dependency overrides so installation needs no private registry. Cards demonstrates a small solo game; Canvas includes TV Party phone and watch controls. Follow each game's README and manifest when adapting it.

## Upload a production preview

Production admission is enabled. Project owners have uploaded builds and opened private previews on memefreegames.com.

1. Open [Your games](https://memefreegames.com/developer/projects), sign in and create a project. Set the `slug` in `mfg.game.ts` to the project's MFG address. The project ID and address are different values.
2. Install the **MFG Developers** GitHub App for your game repository. Enter the repository owner/name, branch and caller workflow file `.github/workflows/production.yml` in the project's repository settings. Choose **Connect with GitHub**.
3. Delete the starter's `.github/workflows/preview.yml`. It targets staging, which has separate accounts and projects.
4. Set the repository's Actions variable `MFG_PRODUCTION_PROJECT_ID` to the project ID shown on your project page.
5. Add this caller as `.github/workflows/production.yml`:

```yaml
name: MFG production preview
on:
  workflow_dispatch:
permissions:
  contents: read
  actions: read
  id-token: write
jobs:
  preview:
    uses: olavblj/mfg-developer-toolkit/.github/workflows/external-game-production.yml@e1b31a3998e5c4ba5c446ccb55f1e49dea6c63b7
    with:
      project: ${{ vars.MFG_PRODUCTION_PROJECT_ID }}
      version: 0.0.${{ github.run_number }}
```

Run the caller from your repository's **Actions** tab. Open the private preview from your project page. Review the immutable build, then publish explicitly from the developer project. Upload credentials can create builds but cannot publish them.

Bind **that exact caller filename** in the project's repository settings. It differs from the reusable toolkit workflow path above. Keep the caller and server allowlist pinned to the exact workflow commit shown above.

The production workflow sets `VITE_MFG_SHELL_ORIGIN=https://memefreegames.com` during the unprivileged build. Both starters need this for their message bridges; their local default remains staging. For a local production build, run:

```sh
VITE_MFG_SHELL_ORIGIN=https://memefreegames.com pnpm build
```

The production API is `https://memefreegames.com/api`. The requested OIDC audience is `https://memefreegames.com/external`. The trusted uploader remains pinned to `9d3238f944fa41fcee1af74d25658641a0e46f80`. All upstream actions also use verified full commit IDs. Keep these immutable references intact.

Read https://memefreegames.com/developers/agent.txt for the site guide.

## Staging previews for MFG testing

Use staging when MFG asks you to test there. It has separate accounts and projects. Create and claim a project on the staging site, connect the repository through the GitHub App, and set the repository's Actions variable `MFG_PROJECT_ID` to that project's ID. Keep the starter's `.github/workflows/preview.yml` for this path. It runs on pushes to `main` or manual dispatch and calls:

```yaml
uses: olavblj/mfg-developer-toolkit/.github/workflows/external-game.yml@c836638626c1cae2d486b789fd7621000b8ce6f3
```

The staging API is `https://staging.memefreegames.com/api`. The requested audience is `https://staging.memefreegames.com/external`. The workflow builds without OIDC permission. A separate job downloads inert output and invokes the trusted uploader pinned to `9d3238f944fa41fcee1af74d25658641a0e46f80`. It creates a private staging preview. Publication remains an owner action. This workflow never publishes to production.

## Distribution

`vendor` contains the audited installable runtime archives; `archives.json` records their SHA-256 values. The `uploader` directory has its own frozen dependency lock and installs with lifecycle scripts disabled. Each template is independently copyable and carries its own archives, lockfile and MIT license. Character archives carry their separate asset notice.
