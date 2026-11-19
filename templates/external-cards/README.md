# external-cards

An independent MFG game. Run `pnpm install`, then `pnpm dev`. Run `pnpm build` to create the inert upload artifact. All MFG dependencies are included in vendor; no access to MFG's private repository is needed. Commit the generated lockfile before running the reusable workflow.

Create your project at https://memefreegames.com/developer/projects. Install the **MFG Developers** GitHub App for your repository. Follow the toolkit README to add `.github/workflows/production.yml` and set the Actions variable `MFG_PRODUCTION_PROJECT_ID`. Delete the bundled `.github/workflows/preview.yml` unless MFG has asked you to test on staging.

Read https://memefreegames.com/developers/agent.txt for repository linking and preview review. Publication remains an owner action.
