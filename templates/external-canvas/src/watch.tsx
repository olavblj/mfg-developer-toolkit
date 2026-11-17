import { useEffect, useState } from "react";
import { watchLobby } from "@mfg/realtime/client";
import type { connectExternalPlatform } from "@mfg/sdk/bridge";
import manifest from "../mfg.game";

/** Uses the shared delayed spectator client; no player seat or input channel is created. */
export function WatchOrbit({ bridge }: { bridge: Awaited<ReturnType<typeof connectExternalPlatform>> }) {
  const [status, setStatus] = useState("Connecting to watch…");
  useEffect(() => {
    if (!bridge.WebSocket) {
      setStatus("Watching is unavailable in this shell.");
      return;
    }
    const spectator = watchLobby<{ view: { status: string } }>({
      game: manifest.slug,
      token: new URLSearchParams(location.search).get("watch") ?? "",
      origin: "https://mfg-runtime.invalid",
      WebSocket: bridge.WebSocket,
    });
    const update = () =>
      setStatus(
        spectator.error?.message ??
          (spectator.status === "open" ? (spectator.view?.status ?? "Watching the TV room") : spectator.status),
      );
    const stop = spectator.onChange(update);
    void spectator.watching.then(update).catch(update);
    return () => {
      stop();
      spectator.close();
    };
  }, [bridge]);
  return (
    <main style={{ padding: 20 }}>
      <h1>Watching Canvas Orbit</h1>
      <p>Read-only view, delayed a few seconds.</p>
      <p role="status">{status}</p>
    </main>
  );
}
