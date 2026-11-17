import { applyBindings } from "@mfg/input";
import { createInputRuntime } from "@mfg/input/runtime";
import { createRng, fixedStep } from "@mfg/sim";
import { gameInputOptions } from "@mfg/ui";
import manifest from "../mfg.game";

/** Starts a Canvas renderer with shared input and fixed-step simulation; returns teardown and collection feedback. */
export function startOrbit(
  canvas: HTMLCanvasElement,
  gate: () => { blocked: boolean; revision: number },
  collect: () => void,
) {
  const drawing = canvas.getContext("2d")!;
  const rng = createRng(42);
  let angle = (rng.int(360) * Math.PI) / 180,
    stopped = false;
  const shared = gameInputOptions();
  const makeInput = (bindings: unknown) =>
    createInputRuntime({
      controls: applyBindings(manifest.controls, bindings),
      singlePlayer: true,
      ...shared,
      gameplayGate: () => {
        const shell = gate(),
          local = shared.gameplayGate();
        return { blocked: shell.blocked || local.blocked, revision: shell.revision + local.revision };
      },
    });
  let input = makeInput(null);
  let savedBindings = "null";
  const draw = () => {
    drawing.fillStyle = "#14243b";
    drawing.fillRect(0, 0, 480, 320);
    drawing.strokeStyle = "#7ba5cd";
    drawing.lineWidth = 3;
    drawing.beginPath();
    drawing.ellipse(240, 160, 130, 100, 0, 0, Math.PI * 2);
    drawing.stroke();
    drawing.fillStyle = "#ffd27d";
    drawing.beginPath();
    drawing.arc(240 + 130 * Math.cos(angle), 160 + 100 * Math.sin(angle), 14, 0, Math.PI * 2);
    drawing.fill();
    drawing.fillStyle = "#fff";
    drawing.font = "20px sans-serif";
    drawing.textAlign = "center";
    drawing.fillText("Collect the orbit spark", 240, 165);
  };
  const clock = fixedStep({
    hz: 60,
    step: () => {
      angle += Math.PI / 180;
    },
    render: draw,
  });
  let last = performance.now(),
    frame = 0;
  function tick(now: number) {
    if (stopped) return;
    const frames = input.poll();
    if (!gate().blocked) {
      if (frames.get(0)?.pressed.has("collect")) collect();
      clock.advance(now - last);
    }
    last = now;
    frame = requestAnimationFrame(tick);
  }
  draw();
  frame = requestAnimationFrame(tick);
  return {
    bindings: (bindings: unknown) => {
      const encoded = JSON.stringify(bindings ?? null);
      if (encoded === savedBindings) return;
      savedBindings = encoded;
      input.dispose();
      input = makeInput(bindings);
    },
    collected: () => {
      angle = (rng.int(360) * Math.PI) / 180;
      draw();
    },
    dispose: () => {
      stopped = true;
      cancelAnimationFrame(frame);
      input.dispose();
    },
  };
}
