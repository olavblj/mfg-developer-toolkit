import { rememberLobby } from "@mfg/realtime/client";
import { mountTvPad } from "@mfg/pad";
import { tvMode } from "@mfg/sdk";
import { connectExternalPlatform } from "@mfg/sdk/bridge";
import "@mfg/ui/theme.css";
import "@mfg/pad/controls.css";
import manifest from "../mfg.game";
const shell = import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com";
void connectExternalPlatform(shell)
  .then((bridge) => {
    if (!bridge.WebSocket) throw new Error("This shell cannot connect controllers.");
    const code = new URLSearchParams(location.search).get("code");
    if (bridge.controllerName && code) rememberLobby(manifest.slug, { code, name: bridge.controllerName });
    mountTvPad(document.getElementById("root")!, {
      game: manifest,
      tv: tvMode(manifest),
      transport: { origin: "https://mfg-runtime.invalid", WebSocket: bridge.WebSocket },
    });
  })
  .catch((error) => {
    document.getElementById("root")!.textContent = String(error);
  });
