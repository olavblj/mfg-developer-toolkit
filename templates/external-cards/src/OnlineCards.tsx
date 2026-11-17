import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Input } from "@mfg/ui";
import { createLobby, joinLobby, type Lobby, type LobbySeatClient } from "@mfg/realtime/client";
import type { createPlatform } from "@mfg/sdk/client";
import type { connectExternalPlatform } from "@mfg/sdk/bridge";
import type { ResourceRecord } from "@mfg/resources";
import manifest from "../mfg.game";

type Cards = { pick: string; view: { status: string; finished: boolean; started: boolean } };
type Bridge = Awaited<ReturnType<typeof connectExternalPlatform>>;
export function OnlineCards({
  platform,
  bridge,
  cards,
  paused,
  tieMargin,
}: {
  platform: ReturnType<typeof createPlatform>;
  bridge: Bridge;
  cards: ResourceRecord[];
  paused: boolean;
  tieMargin: number;
}) {
  const host = useRef<Lobby<Cards> | null>(null);
  const peer = useRef<LobbySeatClient<Cards> | null>(null);
  const clean = useRef<(() => void)[]>([]);
  const [code, setCode] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("code") ?? "";
    return /^[A-Z]{4}$/.test(requested) ? requested : "";
  });
  const [letter, setLetter] = useState<number | null>(null);
  const [status, setStatus] = useState("Host a room or enter a friend's room code.");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [retry, setRetry] = useState(false);
  const saveResult = useRef<(() => Promise<void>) | null>(null);
  function leave() {
    for (const stop of clean.current.splice(0)) stop();
    host.current?.close();
    peer.current?.leave();
    host.current = null;
    peer.current = null;
    saveResult.current = null;
  }
  useEffect(() => leave, []);
  useEffect(() => {
    host.current?.setPaused(paused);
  }, [paused]);
  const readPick = (value: unknown) =>
    typeof value === "string" && cards.some((card) => card.id === value) ? value : "";
  async function connect(hosting: boolean) {
    if (!bridge.WebSocket) return setStatus("This shell does not support rooms yet.");
    setBusy(true);
    leave();
    setFinished(false);
    setStarted(false);
    setRetry(false);
    try {
      const transport = { origin: "https://mfg-runtime.invalid", WebSocket: bridge.WebSocket };
      if (hosting) {
        const lobby = createLobby<Cards>({
          ...transport,
          fetch: bridge.fetch,
          game: manifest.slug,
          maxSeats: 2,
          mode: "separate",
          join: "open",
          watch: "off",
          rules: { minPlayers: 2, configure: "host", start: "host" },
          readPick,
        });
        host.current = lobby;
        lobby.addSeat({ source: "local", name: "Host", ready: true });
        let roundFinished = false;
        let registered = false;
        let registering = false;
        const match = crypto.randomUUID();
        const update = () => {
          if (roundFinished) return;
          if (!registered) {
            if (!registering && lobby.seats.length === 2 && lobby.seats.every((seat) => seat.connected)) {
              registering = true;
              setStatus("Registering match participants…");
              void lobby.startMatch(match).then((reply) => {
                if (host.current !== lobby) return;
                registering = false;
                if (reply.error) {
                  setStatus(`${reply.error}. Leave and open a new room.`);
                  return;
                }
                registered = true;
                setStarted(true);
                update();
              });
            }
            return;
          }
          const ready = lobby.seats.length === 2 && lobby.seats.every((seat) => seat.connected && seat.pick);
          const powers = lobby.seats.map((seat) =>
            Number(cards.find((card) => card.id === seat.pick)?.data.power ?? 0),
          );
          const tied = Math.abs(powers[0]! - powers[1]!) <= tieMargin;
          const result = ready
            ? tied
              ? "It's a tie. Choose again!"
              : `${lobby.seats[powers[0]! > powers[1]! ? 0 : 1]!.name} chose the higher card!`
            : `Room ${lobby.code || "opening"}: ${lobby.seats.length}/2 players. Choose a card.`;
          setStatus(result);
          lobby.publish({ status: result, finished: false, started: true });
          if (ready && !tied) {
            roundFinished = true;
            setFinished(true);
            const winner = powers[0]! > powers[1]! ? 0 : 1;
            const input = {
              v: 1 as const,
              game: manifest.slug,
              match,
              mode: "online" as const,
              seats: lobby.seats.map((seat, index) => ({
                seat: index,
                kind: "human" as const,
                placement: index === winner ? 1 : 2,
                ...(seat.source === "local" ? { host: true as const } : { room: seat.remote! }),
              })),
            };
            let saving = false;
            const save = async () => {
              if (saving || host.current !== lobby) return;
              saving = true;
              setBusy(true);
              setRetry(false);
              try {
                const receipt = await platform.results.report(input, lobby);
                if (host.current !== lobby) return;
                const status = receipt.counted
                  ? `${result} Result saved.`
                  : `${result} ${receipt.error ?? "Result could not be saved."}`;
                setStatus(status);
                setRetry(!receipt.counted);
                lobby.publish({ status, finished: true, started: true });
              } catch {
                if (host.current === lobby) {
                  setRetry(true);
                  setStatus(`${result} Retry saving the result.`);
                }
              } finally {
                saving = false;
                if (host.current === lobby) setBusy(false);
              }
            };
            saveResult.current = save;
            lobby.publish({ status: `${result} Saving result…`, finished: true, started: true });
            void save();
          }
        };
        clean.current.push(lobby.onChange(update));
        await lobby.openRoom();
        setCode(lobby.code);
        if (!registered) setStatus(`Room ${lobby.code}: waiting for a second player.`);
        update();
      } else {
        const seat = joinLobby<Cards>({
          ...transport,
          game: manifest.slug,
          code,
          name: "Challenger",
          readPick,
          remember: false,
        });
        peer.current = seat;
        clean.current.push(
          seat.onChange(() => {
            setStatus(seat.error?.message ?? seat.view?.status ?? `Room ${seat.code}: connecting…`);
            setFinished(Boolean(seat.view?.finished));
            setStarted(Boolean(seat.view?.started));
          }),
        );
        await seat.joined;
      }
      setActive(true);
    } catch (error) {
      leave();
      setActive(false);
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Online cards">
      <h2>Play with a friend</h2>
      <p role="status">{status}</p>
      <>
        {!active ? (
          <>
            <Button disabled={busy || paused || !cards.length} onClick={() => void connect(true)}>
              Host online room
            </Button>
            <label>
              Room code
              <Input
                aria-label="Room code"
                value={code}
                maxLength={4}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
            </label>
            {[0, 1, 2, 3].map((index) => (
              <Button key={index} disabled={busy || paused} onClick={() => setLetter(index)}>
                Room letter {index + 1}: {code[index] ?? "choose"}
              </Button>
            ))}
            <Button disabled={busy || paused || code.length !== 4 || !cards.length} onClick={() => void connect(false)}>
              Join online room
            </Button>
          </>
        ) : (
          <>
            {cards.map((card) => (
              <Button
                key={card.id}
                disabled={paused || finished || !started}
                onClick={() => {
                  if (host.current) host.current.updateSeat(0, { pick: card.id });
                  else peer.current?.pick(card.id);
                }}
              >
                Play {String(card.data.name)}
              </Button>
            ))}
            {retry && (
              <Button disabled={busy || paused} onClick={() => void saveResult.current?.()}>
                Retry saving result
              </Button>
            )}
            <Button
              onClick={() => {
                leave();
                setActive(false);
                setStatus("You left the room.");
              }}
            >
              Leave online room
            </Button>
          </>
        )}
      </>
      {letter !== null && (
        <Dialog
          title={`Choose room letter ${letter + 1}`}
          onClose={() => setLetter(null)}
          actions={Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (value) => ({
            id: value,
            label: value,
            onSelect: () => {
              setCode(
                (current) => current.padEnd(4, "A").slice(0, letter) + value + current.padEnd(4, "A").slice(letter + 1),
              );
              setLetter(null);
            },
          }))}
        >
          <p>Choose a letter with your keyboard, controller or touch.</p>
        </Dialog>
      )}
    </section>
  );
}
