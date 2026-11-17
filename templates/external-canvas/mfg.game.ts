import { defineGame } from "@mfg/sdk";
export default defineGame({
  slug: "external-canvas",
  title: "Canvas Orbit",
  tagline: "Collect sparks from a tiny orbit.",
  description: "An independent Canvas 2D integration fixture using shared input, simulation and managed match rewards.",
  icon: "icon.svg",
  genres: ["arcade"],
  status: "in-development",
  players: { min: 1, max: 2 },
  modes: ["solo", "tv-party"],
  plan: { kind: "free" },
  character: { use: "none" },
  tv: { seats: 2, minPlayers: 1, localSeats: false, keyboardSeats: false, cpu: false },
  controls: {
    devices: ["keyboard", "gamepad", "touch", "phone-pad"],
    actions: [
      {
        id: "collect",
        label: "Collect spark",
        kind: "button",
        keyboard: [["Space"]],
        gamepad: ["west"],
        slot: "action1",
      },
    ],
  },
  leaderboards: [
    {
      id: "sparks",
      title: "Sparks",
      description: "Sparks collected from the orbit.",
      unit: "count",
      aggregation: "sum",
    },
  ],
  achievements: [{ id: "first-spark", title: "First spark", description: "Collect one orbit spark.", tier: "bronze" }],
  results: {
    selfReport: ["solo"],
    boards: [{ board: "sparks", value: 1, when: { won: true } }],
    achievements: [{ achievement: "first-spark", when: { won: true } }],
  },
});
