import { useEffect, useRef, useState } from "react";
import { tvMode } from "@mfg/sdk";
import { createPlatform } from "@mfg/sdk/client";
import {
  externalPhoneLink,
  externalPartyReturn,
  externalWatchLink,
  externalShellControls,
  externalShellMenu,
  type connectExternalPlatform,
} from "@mfg/sdk/bridge";
import { Button, createTvParty, TvLobbyScreen } from "@mfg/ui";
import manifest from "../mfg.game";
const shell = import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com";

/** A display-only TV fixture: authenticated phone seats collect a spark, with one durable match receipt. */
export function TvOrbit({ bridge }: { bridge: Awaited<ReturnType<typeof connectExternalPlatform>> }) {
  const [party, setParty] = useState<ReturnType<typeof createTvParty> | null>(null);
  const [phone, setPhone] = useState("");
  const [watchLink, setWatchLink] = useState("");
  const [status, setStatus] = useState("Opening the TV room…");
  const [retry, setRetry] = useState(false);
  const [canReturn, setCanReturn] = useState(false);
  const [, refresh] = useState(0);
  const save = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (!bridge.WebSocket) {
      setStatus("This shell cannot host TV rooms.");
      return;
    }
    const platform = createPlatform({ manifest, fetch: bridge.fetch, mediaOrigin: bridge.mediaOrigin });
    const created = createTvParty({
      game: manifest.slug,
      tv: tvMode(manifest),
      controls: manifest.controls,
      transport: { origin: "https://mfg-runtime.invalid", WebSocket: bridge.WebSocket, fetch: bridge.fetch },
      onPartyReturn: () => {
        void externalPartyReturn(bridge).catch((error) => setStatus(String(error)));
      },
      onPause: () => externalShellMenu(shell, "pause"),
      onMenu: (action) => externalShellMenu(shell, action),
    });
    created.lobby.setPolicies({ watch: "link" });
    setParty(created);
    let alive = true,
      paused = false,
      registered = false,
      pending = false,
      done = false;
    let match = "",
      requestedCode = "",
      requestedWatch = "",
      frame = 0;
    let winner: number | null = null;
    let seats = created.seats;
    const changed = created.onChange(() => {
      refresh((value) => value + 1);
      const token = created.lobby.policies.watchToken;
      if (token && token !== requestedWatch) {
        requestedWatch = token;
        void externalWatchLink(bridge, token)
          .then((url) => {
            if (alive) setWatchLink(url);
          })
          .catch((error) => {
            if (alive) setStatus(String(error));
          });
      }
      if (created.code && requestedCode !== created.code) {
        requestedCode = created.code;
        void externalPhoneLink(bridge, created.code)
          .then((url) => {
            if (alive) setPhone(url);
          })
          .catch((error) => {
            if (alive) setStatus(String(error));
          });
      }
    });
    const stopPause = externalShellControls(shell, (value) => {
      paused = value;
      created.setPaused(value);
    });
    async function report() {
      if (pending || done || winner === null) return;
      pending = true;
      setRetry(false);
      setStatus("Saving the spark…");
      try {
        const receipt = await platform.results.report(
          {
            v: 1,
            game: manifest.slug,
            match,
            mode: "tv-party",
            seats: seats.map((seat) => ({
              seat: seat.seat,
              ...created.resultSeat(seat.seat),
              placement: seat.seat === winner ? 1 : 2,
            })),
          },
          created.lobby,
        );
        if (!receipt.counted) throw new Error(receipt.error ?? "The spark was not saved.");
        if (!alive) return;
        done = true;
        setCanReturn(true);
        created.lobby.publish({ status: "A spark was collected" });
        setStatus(`${seats.find((seat) => seat.seat === winner)?.name ?? "A player"} collected the spark.`);
      } catch (error) {
        if (alive) {
          setRetry(true);
          setStatus(String(error));
        }
      } finally {
        pending = false;
      }
    }
    created.lobby.publish({ status: "Waiting for players" });
    save.current = report;
    const stopStart = created.onStart((players) => {
      match = crypto.randomUUID();
      seats = players;
      winner = null;
      registered = false;
      done = false;
      setCanReturn(false);
      setRetry(false);
      setStatus("Registering the players…");
      const registeredMatch = match;
      void created.lobby
        .startMatch(match)
        .then((result) => {
          if (!alive || match !== registeredMatch || created.phase !== "playing") return;
          if (result.error) {
            setCanReturn(true);
            setStatus(`${result.error}. Return to the lobby and try again.`);
            return;
          }
          created.lobby.publish({ status: "A round is in progress" });
          registered = true;
          setStatus("Collect a spark on your phone.");
        })
        .catch((error) => {
          if (alive) {
            setCanReturn(true);
            setStatus(String(error));
          }
        });
    });
    const tick = () => {
      created.pollLobby();
      const frames = created.input.poll();
      if (created.phase === "playing" && registered && !paused && !pending && !done && winner === null) {
        for (const [seat, input] of frames) {
          if (input.pressed.has("collect") && seats.some((player) => player.seat === seat)) {
            winner = seat;
            void report();
            break;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      changed();
      stopPause();
      stopStart();
      created.dispose();
      save.current = null;
    };
  }, [bridge]);
  return (
    <main style={{ maxWidth: 720, margin: "auto", padding: 20 }}>
      <h1>Canvas Orbit TV</h1>
      <p role="status">{status}</p>
      {watchLink && (
        <>
          <label>
            Watch link
            <input readOnly value={watchLink} />
          </label>
          <Button
            onClick={() => {
              party?.lobby.setPolicies({ watch: "off" });
              setWatchLink("");
            }}
          >
            Stop watching
          </Button>
        </>
      )}
      {party?.phase === "lobby" && phone && (
        <TvLobbyScreen party={party} gameTitle={manifest.title} joinHref={() => phone} />
      )}
      {retry && <Button onClick={() => void save.current?.()}>Retry saving spark</Button>}
      {party?.phase === "playing" && (
        <Button disabled={!canReturn} onClick={() => party.end()}>
          Return to lobby
        </Button>
      )}
    </main>
  );
}
