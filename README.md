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

## Upload a staging preview

This initial workflow targets **staging only**: `https://staging.memefreegames.com/api`. It requests the audience `https://staging.memefreegames.com/external`. Hosted project creation, repository consent and upload admission must be enabled separately by MFG; repository publication alone does not enable those services.

Create and claim your developer project through the staging site, connect the game repository through the GitHub App, and set that repository's Actions variable `MFG_PROJECT_ID` to the project's ID. The included preview workflow runs on pushes to `main` or manual dispatch. It builds without OIDC permission; a separate job downloads inert output and invokes the pinned trusted uploader. It creates a private staging preview. Public game publication remains an owner action. This workflow never publishes to production.

The template calls:

```yaml
uses: olavblj/mfg-developer-toolkit/.github/workflows/external-game.yml@c836638626c1cae2d486b789fd7621000b8ce6f3
```

The reusable workflow pins trusted upload tooling to `9d3238f944fa41fcee1af74d25658641a0e46f80`. All upstream actions also use verified full commit IDs. Keep these immutable references intact.

## Distribution

`vendor` contains the audited installable runtime archives; `archives.json` records their SHA-256 values. The `uploader` directory has its own frozen dependency lock and installs with lifecycle scripts disabled. Each template is independently copyable and carries its own archives, lockfile and MIT license. Character archives carry their separate asset notice.

## Prepared production workflow

`external-game-production.yml` contains the separately reviewed production API and audience coordinates and uses the same immutable trusted uploader. It is published for release preparation only: MFG production admission remains disabled until an explicitly authorized platform rollout. The existing staging workflow and template pins are unchanged. Do not substitute a branch or tag when configuring a production caller; use the verified commit containing this file and the matching server allowlist at rollout.
