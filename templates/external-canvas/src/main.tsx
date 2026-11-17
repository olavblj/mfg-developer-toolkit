import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPlatform } from "@mfg/sdk/client";
import { connectExternalPlatform, externalShellControls, externalPreferences } from "@mfg/sdk/bridge";
import { Button, MenuColumn } from "@mfg/ui";
import "@mfg/ui/theme.css";
import manifest from "../mfg.game";
import { WatchOrbit } from "./watch";
import { TvOrbit } from "./tv";
import { startOrbit } from "./orbit";
const shell = import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com";
function Game({ platform }: { platform: ReturnType<typeof createPlatform> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gate = useRef({ blocked: false, revision: 0 });
  const [paused, setPaused] = useState(false),
    [count, setCount] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const act = useRef(() => {});
  useEffect(
    () =>
      externalShellControls(shell, (value) => {
        if (gate.current.blocked !== value) gate.current = { blocked: value, revision: gate.current.revision + 1 };
        setPaused(value);
      }),
    [],
  );
  useEffect(() => {
    let pending = false,
      match = crypto.randomUUID(),
      alive = true;
    const collect = async () => {
      if (pending || gate.current.blocked) return;
      pending = true;
      setBusy(true);
      setError("");
      try {
        const receipt = await platform.results.report({
          v: 1,
          game: manifest.slug,
          match,
          mode: "solo",
          seats: [{ seat: 0, kind: "human", self: true, placement: 1 }],
        });
        if (!receipt.counted) throw new Error(receipt.error ?? "Spark was not saved");
        match = crypto.randomUUID();
        if (alive) {
          setCount((value) => value + 1);
          orbit.collected();
        }
      } catch (error) {
        if (alive) setError(String(error));
      } finally {
        pending = false;
        if (alive) setBusy(false);
      }
    };
    const orbit = startOrbit(
      canvas.current!,
      () => gate.current,
      () => void collect(),
    );
    const stopPreferences = externalPreferences(shell, (preferences) => orbit.bindings(preferences.bindings));
    act.current = () => void collect();
    return () => {
      alive = false;
      act.current = () => {};
      stopPreferences();
      orbit.dispose();
    };
  }, [platform]);
  return (
    <main style={{ maxWidth: 640, margin: "auto", padding: 20 }}>
      <h1>Canvas Orbit</h1>
      <p role="status">
        {paused ? "Paused · " : ""}Collected {count} sparks.
      </p>
      {error && <p role="alert">{error}</p>}
      <canvas
        ref={canvas}
        width={480}
        height={320}
        tabIndex={0}
        aria-label="Orbit playfield"
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 16 }}
      />
      <p>Press Space, the west gamepad button, or Collect spark. Escape and Start open MFG’s pause menu.</p>
      <MenuColumn>
        <Button disabled={paused || busy} onClick={() => act.current()}>
          Collect spark
        </Button>
      </MenuColumn>
    </main>
  );
}
const root = createRoot(document.getElementById("root")!);
void connectExternalPlatform(shell)
  .then((bridge) =>
    root.render(
      new URLSearchParams(location.search).has("watch") ? (
        <WatchOrbit bridge={bridge} />
      ) : new URLSearchParams(location.search).get("mode") === "tv-party" ? (
        <TvOrbit bridge={bridge} />
      ) : (
        <Game platform={createPlatform({ manifest, fetch: bridge.fetch, mediaOrigin: bridge.mediaOrigin })} />
      ),
    ),
  )
  .catch((error) => root.render(<p role="alert">Open this build through its MFG preview. {String(error)}</p>));
