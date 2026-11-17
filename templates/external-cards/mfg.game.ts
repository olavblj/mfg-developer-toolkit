import { defineGame } from "@mfg/sdk";
export default defineGame({
  slug: "external-cards",
  title: "Pocket Cards",
  tagline: "Find the highest card and build a tiny deck.",
  description: "An independent card game demonstrating private previews, shared match rewards and player-owned decks.",
  icon: "icon.svg",
  genres: ["cards"],
  status: "in-development",
  players: { min: 1, max: 2 },
  modes: ["solo", "online"],
  voice: { default: "players", options: ["players", "spectators-listen"], guestsTalk: false },
  plan: { kind: "free" },
  lore: {},
  posts: [
    {
      id: "stories",
      title: "Stories",
      description: "Share a story about the cards.",
      blocks: ["text"],
      fromSite: true,
      requiresAccount: true,
    },
  ],
  character: { use: "none" },
  tv: { unsupported: "This reference currently supports solo and online rooms; a shared TV screen is not available." },
  controls: {
    devices: ["keyboard", "gamepad", "touch"],
    actions: [{ id: "choose", label: "Choose card", kind: "button", keyboard: [["Space"]], slot: "action1" }],
  },
  leaderboards: [
    { id: "wins", title: "Wins", description: "Correctly choose the highest card.", unit: "count", aggregation: "sum" },
  ],
  achievements: [{ id: "first-win", title: "Sharp eyes", description: "Choose the highest card.", tier: "bronze" }],
  results: {
    selfReport: ["solo"],
    boards: [{ board: "wins", value: 1, when: { won: true } }],
    achievements: [{ achievement: "first-win", when: { won: true } }],
  },
  settings: [
    { id: "show-power", label: "Show card power", type: "toggle", scope: "player", default: true },
    { id: "compact-cards", label: "Compact cards", type: "toggle", scope: "device", default: false },
  ],
  tuning: {
    groups: [
      {
        id: "rules",
        title: "Card rules",
        constants: [
          {
            id: "tie-margin",
            label: "Tie margin",
            hint: "Online cards within this many power points tie.",
            default: 0,
            min: 0,
            max: 3,
            integer: true,
          },
        ],
      },
    ],
  },
  resources: [
    {
      id: "cards",
      title: "Official cards",
      kind: "bundled",
      file: "cards.json",
      schema: {
        version: 1,
        fields: {
          name: { value: { type: "string", maxLength: 40 } },
          power: { value: { type: "number", min: 1, max: 10, integer: true } },
        },
      },
    },
    {
      id: "daily-cards",
      title: "Daily cards",
      kind: "synced",
      source: "pocket-cards-daily",
      fallback: "cards.json",
      schema: {
        version: 1,
        fields: {
          name: { value: { type: "string", maxLength: 40 } },
          power: { value: { type: "number", min: 1, max: 10, integer: true } },
        },
      },
    },
    ...(["private", "public"] as const).map((access) => ({
      id: `${access}-decks`,
      title: `${access} decks`,
      kind: "collection" as const,
      access: access === "private" ? ("private-owner" as const) : ("public-read-owner-write" as const),
      guests: true,
      images: { maxPerOwner: 20 },
      indexes: ["name"],
      schema: {
        version: 1,
        fields: {
          name: { value: { type: "string" as const, maxLength: 80 } },
          cover: { value: { type: "image" as const }, optional: true },
          cards: { value: { type: "array" as const, maxItems: 12, items: { type: "string" as const, maxLength: 40 } } },
        },
      },
    })),
  ],
});
