import { StoryShare } from "./StoryShare";
import { createTuningClient } from "@mfg/tuning/client";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPlatform } from "@mfg/sdk/client";
import { connectExternalPlatform, externalShellControls, externalPreferences } from "@mfg/sdk/bridge";
import { Button, MenuColumn } from "@mfg/ui";
import "@mfg/ui/theme.css";
import type { ResourceRecord } from "@mfg/resources";
import { OnlineCards } from "./OnlineCards";
import manifest from "../mfg.game";

function createCoverBlob(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#243b53";
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = "#ffffff";
  context.font = "24px sans-serif";
  context.fillText("Pocket Cards", 24, 70);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Cover could not be drawn"))), "image/png"),
  );
}

function Game({
  platform,
  bridge,
}: {
  platform: ReturnType<typeof createPlatform>;
  bridge: Awaited<ReturnType<typeof connectExternalPlatform>>;
}) {
  const [coverFile] = useState(createCoverBlob);
  useEffect(
    () =>
      externalPreferences(import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com", (p) =>
        setPreferences({ showPower: p.game["show-power"] === true, compact: p.game["compact-cards"] === true }),
      ),
    [],
  );
  const [savedPublic, setSavedPublic] = useState<ResourceRecord | null>(null);
  const [publicImage, setPublicImage] = useState<string | null>(null);
  const [publicCoverOperation, setPublicCoverOperation] = useState(() => crypto.randomUUID());
  const [cards, setCards] = useState<ResourceRecord[]>([]);
  const [tieMargin, setTieMargin] = useState(0);
  const [preferences, setPreferences] = useState({ showPower: true, compact: false });
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState("Loading official cards…");
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState(() => crypto.randomUUID());
  const [deckOperation, setDeckOperation] = useState(() => platform.resources.operationId());
  const [deckId, setDeckId] = useState(() => crypto.randomUUID());
  const [community, setCommunity] = useState<ResourceRecord[]>([]);
  const [publicOperation, setPublicOperation] = useState(() => platform.resources.operationId());
  const [publicDeckId, setPublicDeckId] = useState(() => crypto.randomUUID());
  const [cover, setCover] = useState<string | null>(null);
  useEffect(
    () =>
      externalShellControls(import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com", setPaused),
    [],
  );
  useEffect(() => {
    void Promise.all([
      platform.resources.list("cards"),
      createTuningClient({
        game: manifest.slug,
        tuning: manifest.tuning!,
        apiBase: "https://mfg-runtime.invalid/api",
        fetch: bridge.fetch,
        version: null,
      }).current(),
    ])
      .then(([{ records }, tuning]) => {
        setTieMargin(tuning.values["tie-margin"]!);
        setCards(records);
        setMessage("Choose the highest card.");
      })
      .catch((error: Error) => setMessage(error.message));
  }, [platform, bridge.fetch]);
  return (
    <main style={{ maxWidth: 640, margin: "auto", padding: preferences.compact ? 12 : 24 }}>
      <h1>Pocket Cards</h1>
      <p>
        Card power: {preferences.showPower ? "shown" : "hidden"}. Layout:{" "}
        {preferences.compact ? "compact" : "comfortable"}.
      </p>
      <p>Online tie margin: {tieMargin}</p>
      <p role="status">{paused ? "Paused" : message}</p>
      {cover && <img src={cover} alt="Your saved Pocket Cards deck cover" width={256} height={128} />}
      <MenuColumn>
        {cards.map((card) => (
          <Button
            key={card.id}
            variant="secondary"
            disabled={paused || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const won = cards.every((other) => Number(card.data.power) >= Number(other.data.power));
                const receipt = await platform.results.report({
                  v: 1,
                  game: manifest.slug,
                  match,
                  mode: "solo",
                  seats: [{ seat: 0, kind: "human", self: true, placement: won ? 1 : 2 }],
                });
                setMessage(
                  receipt.counted
                    ? won
                      ? "Correct! Your win is saved."
                      : "Try another round."
                    : (receipt.error ?? "The result was not saved."),
                );
                if (receipt.counted) setMatch(crypto.randomUUID());
              } catch (error) {
                setMessage(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            {String(card.data.name)}
            {preferences.showPower ? ` · ${String(card.data.power)}` : ""}
          </Button>
        ))}
        <Button
          variant="secondary"
          disabled={paused || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const daily = await platform.resources.list("daily-cards");
              const freshness = daily.freshness;
              const source =
                freshness && "fallback" in freshness && freshness.fallback
                  ? "bundled fallback"
                  : freshness && "stale" in freshness && freshness.stale
                    ? "last good snapshot"
                    : "managed snapshot";
              setMessage(`Daily cards: ${daily.records.map((card) => String(card.data.name)).join(", ")} (${source}).`);
            } catch (error) {
              setMessage(String(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Read daily cards
        </Button>
        <Button
          variant="secondary"
          disabled={paused || busy || !cards.length}
          onClick={async () => {
            setBusy(true);
            try {
              const file = await coverFile;
              const image = await platform.resources.uploadImage("private-decks", file, deckOperation);
              await platform.resources.create(
                "private-decks",
                deckId,
                {
                  name: "Starter",
                  cards: cards.map((card) => card.id),
                  cover: image.id,
                },
                deckOperation,
              );
              setCover(platform.resources.imageUrl(image.id));
              setDeckOperation(platform.resources.operationId());
              setDeckId(crypto.randomUUID());
              const decks = await platform.resources.list("private-decks");
              setMessage(`Saved your deck. You have ${decks.records.length} private decks.`);
            } catch (error) {
              setMessage(String(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save private deck
        </Button>
        <Button
          variant="secondary"
          disabled={paused || busy || !cards.length}
          onClick={async () => {
            setBusy(true);
            try {
              const shared = await platform.resources.create(
                "public-decks",
                publicDeckId,
                { name: "Starter", cards: cards.map((card) => card.id) },
                publicOperation,
              );
              setSavedPublic(shared);
              setPublicImage(null);
              setPublicCoverOperation(crypto.randomUUID());
              setPublicOperation(platform.resources.operationId());
              setPublicDeckId(crypto.randomUUID());
              setMessage("Shared your deck with the community.");
            } catch (error) {
              setMessage(String(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Share public deck
        </Button>
        {savedPublic && !savedPublic.data.cover && (
          <Button
            variant="secondary"
            disabled={paused || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const image = await platform.resources.uploadImage(
                  "public-decks",
                  await coverFile,
                  publicCoverOperation,
                );
                setPublicImage(image.id);
                if (image.state === "ready") {
                  const record = await platform.resources.update(
                    "public-decks",
                    savedPublic.id,
                    { ...savedPublic.data, cover: image.id },
                    savedPublic.revision,
                    publicCoverOperation,
                  );
                  setSavedPublic(record);
                  setMessage("Approved cover attached to your public deck.");
                } else setMessage("Public cover is waiting for moderator approval.");
              } catch (error) {
                setMessage(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            {publicImage ? "Check cover approval" : "Submit public deck cover"}
          </Button>
        )}
        {savedPublic?.data.cover && publicImage && (
          <Button
            variant="secondary"
            disabled={paused || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await platform.resources.reportImage("public-decks", publicImage, "This public cover needs moderation");
                setMessage("Public cover reported for review.");
              } catch (error) {
                setMessage(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Report public deck cover
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={paused || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const page = await platform.resources.list("public-decks", { scope: "public" });
              setCommunity(page.records);
              setMessage(`Found ${page.records.length} community decks.`);
            } catch (error) {
              setMessage(String(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Browse community decks
        </Button>
        {community.map((deck) => (
          <Button
            key={`report:${deck.owner}:${deck.id}`}
            variant="secondary"
            disabled={paused || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await platform.resources.report("public-decks", deck, "This community deck needs moderation");
                setMessage("Deck reported for review.");
              } catch (error) {
                setMessage(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Report deck: {String(deck.data.name)}
          </Button>
        ))}
        <OnlineCards platform={platform} bridge={bridge} cards={cards} paused={paused} tieMargin={tieMargin} />
      </MenuColumn>
      <StoryShare platform={platform} paused={paused} />
      {community.length > 0 && (
        <section aria-label="Community decks">
          <h2>Community decks</h2>
          <ul>
            {community.map((deck) => (
              <li key={`${deck.owner}:${deck.id}`}>
                {String(deck.data.name)} · {(deck.data.cards as string[]).length} cards
                {typeof deck.data.cover === "string" && (
                  <img
                    src={platform.resources.imageUrl(deck.data.cover)}
                    alt="Community deck cover"
                    width={128}
                    height={64}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
const root = createRoot(document.getElementById("root")!);
void connectExternalPlatform(import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com")
  .then((bridge) => {
    root.render(
      <Game
        platform={createPlatform({ manifest, fetch: bridge.fetch, mediaOrigin: bridge.mediaOrigin })}
        bridge={bridge}
      />,
    );
  })
  .catch((error: Error) => root.render(<p role="alert">Open this build through its MFG preview. {error.message}</p>));
