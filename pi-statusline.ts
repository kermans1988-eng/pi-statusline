/**
 * pi-statusline.ts — Statusline Extension для pi (v7)
 *
 * УСТАНОВКА:
 *   cp pi-statusline.ts ~/.pi/agent/extensions/
 *   /reload
 *
 * LAYOUT — футер заменяет встроенный, рендерит 3 строки:
 *   строка 1:  cwd   model: xxx   thinking: xxx
 *   (пустая)
 *   строка 2:  ↑tok ↓tok  elapsed  used/total  $cost  ctx bar%  HH:MM
 *
 * КОМАНДЫ:
 *   /statusline          — toggle
 *   /statusline on|off   — вкл / выкл
 *   /statusline reset    — сбросить счётчики
 *
 * Состояние on/off сохраняется в ~/.pi/statusline.state
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ─── Персистентный флаг ───────────────────────────────────────────────────────
const STATE_FILE = path.join(os.homedir(), ".pi", "statusline.state");

function loadEnabled(): boolean {
  try { return fs.readFileSync(STATE_FILE, "utf8").trim() !== "false"; }
  catch { return true; }
}
function saveEnabled(val: boolean) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, val ? "true" : "false", "utf8");
  } catch { /* ignore */ }
}

// ─── ANSI ─────────────────────────────────────────────────────────────────────
const R    = "\x1b[0m";
const G    = "\x1b[32m";
const Y    = "\x1b[33m";
const RED  = "\x1b[31m";
const GR   = "\x1b[38;5;245m";
const DG   = "\x1b[38;5;240m";
const TIME = "\x1b[38;5;255m";   // ~#f7f7f7

const c = (color: string, s: string | number) => `${color}${s}${R}`;

// ─── Форматирование ────────────────────────────────────────────────────────────
function fmtTok(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} сек`;
  return `${Math.floor(s / 60)} мин ${s % 60} сек`;
}
function fmtCost(usd: number): string {
  if (usd <= 0)    return "$0";
  if (usd < 0.001) return `$${usd.toFixed(4)}`;
  if (usd < 0.01)  return `$${usd.toFixed(3)}`;
  if (usd < 1)     return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd)}`;
}
function ctxBar(pct: number): string {
  const N    = 14;
  const fill = Math.min(Math.round((pct / 100) * N), N);
  const col  = pct >= 90 ? RED : pct >= 60 ? Y : G;
  return `${col}${"█".repeat(fill)}${R}${DG}${"░".repeat(N - fill)}${R}`;
}
function pctCol(pct: number): string {
  return pct >= 90 ? RED : pct >= 60 ? Y : G;
}

// ─── Тип ctx ──────────────────────────────────────────────────────────────────
type Ctx = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

// ─── EXTENSION ────────────────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {

  let enabled  = loadEnabled();
  let liveCtx: Ctx | null = null;

  let sesIn = 0, sesOut = 0, sesCost = 0;
  let tIn = 0, tOut = 0, tCost = 0;
  let tStartMs = 0;
  let lastMs: number | null = null;
  let answered = false;

  // ── Строки ────────────────────────────────────────────────────────────────
  function buildLine1(ctx: Ctx): string {
    const PAD     = "   ";
    const cwd     = ctx.cwd ?? "~";
    const modelId = ctx.model?.id ?? "";
    const tl      = (pi as unknown as { getThinkingLevel?: () => string }).getThinkingLevel?.() ?? "";
    return [
      c(GR, cwd),
      modelId ? `${c(DG, "model:")} ${c(GR, modelId)}`  : "",
      tl      ? `${c(DG, "thinking:")} ${c(GR, tl)}`    : "",
    ].filter(Boolean).join(PAD);
  }

  function buildLine2(ctx: Ctx): string {
    const PAD  = "   ";
    const inN  = tIn  > 0 ? tIn  : sesIn;
    const outN = tOut > 0 ? tOut : sesOut;
    const cost = tCost > 0 ? tCost : sesCost;

    const usage    = ctx.getContextUsage();
    const ctxTok   = usage?.tokens        ?? 0;
    const win      = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
    const pct      = usage?.percent ?? 0;

    const now = new Date();
    const clk = c(TIME, `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);

    return [
      `${c(G,  "↑")}${c(GR, fmtTok(inN))}`,
      `${c(DG, "↓")}${c(GR, fmtTok(outN))}`,
      lastMs !== null ? c(TIME, fmtElapsed(lastMs)) : c(DG, "–"),
      c(GR, `${fmtTok(ctxTok)}/${fmtTok(win)}`),
      c(Y, fmtCost(cost)),
      `${c(DG, "ctx")} ${ctxBar(pct)} ${c(pctCol(pct), `${Math.round(pct)}%`)}`,
      clk,
    ].join(PAD);
  }

  // ── setFooter — единственный надёжный способ ─────────────────────────────
  // В отличие от setWidget, setFooter рендерит каждый элемент массива
  // как отдельную строку терминала без какого-либо схлопывания.
  // Пустая строка между line1 и line2 гарантированно создаёт отступ.
  function installFooter(ctx: Ctx) {
    if (!ctx.hasUI) return;
    liveCtx = ctx;

    ctx.ui.setFooter((_tui, _theme) => ({
      render(_width: number): string[] {
        if (!liveCtx || !enabled) return [];
        return [
          buildLine1(liveCtx),
          "",                    // пустая строка = один отступ между строками
          buildLine2(liveCtx),
        ];
      },
      invalidate() {},
    }));
  }

  function refresh(ctx: Ctx) {
    liveCtx = ctx;
    // Триггерим переустановку чтобы render() вызвался с новым liveCtx
    installFooter(ctx);
  }

  // ── События ───────────────────────────────────────────────────────────────
  pi.on("session_start", (_e, ctx) => {
    sesIn = sesOut = sesCost = 0;
    tIn = tOut = tCost = 0;
    lastMs = null; answered = false;
    installFooter(ctx);
  });

  pi.on("turn_start", (_e, ctx) => {
    tStartMs = Date.now();
    lastMs   = null; answered = false;
    tIn = tOut = tCost = 0;
    refresh(ctx);
  });

  pi.on("message_update", (_e, ctx) => {
    if (!answered && tStartMs > 0) lastMs = Date.now() - tStartMs;
    refresh(ctx);
  });

  pi.on("message_end", (event, ctx) => {
    const msg = (event as {
      message?: {
        role?: string;
        usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
      };
    }).message;

    if (msg?.role === "assistant" && msg.usage) {
      const u     = msg.usage;
      const inTok = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
      const outTok = u.output ?? 0;
      sesIn += inTok;  sesOut += outTok;
      tIn    = inTok;  tOut    = outTok;
      const mc = ctx.model?.cost;
      if (mc) {
        const spent = inTok * (mc.input ?? 0) + outTok * (mc.output ?? 0);
        sesCost += spent; tCost = spent;
      }
      if (tStartMs > 0) { lastMs = Date.now() - tStartMs; answered = true; }
    }
    refresh(ctx);
  });

  pi.on("agent_end",             (_e, ctx) => refresh(ctx));
  pi.on("model_select",          (_e, ctx) => refresh(ctx));
  pi.on("session_compact",       (_e, ctx) => refresh(ctx));
  pi.on("thinking_level_select", (_e, ctx) => refresh(ctx));

  // ── Команда /statusline ───────────────────────────────────────────────────
  pi.registerCommand("statusline", {
    description: "Statusline: toggle on/off, reset counters",

    getArgumentCompletions: (_prefix: string): AutocompleteItem[] => [
      { value: "on",    label: "on    — включить"          },
      { value: "off",   label: "off   — выключить"         },
      { value: "reset", label: "reset — сбросить счётчики"  },
    ],

    handler: async (args, ctx) => {
      const cmd = (args ?? "").trim().toLowerCase();

      if (cmd === "on") {
        enabled = true; saveEnabled(true);
        refresh(ctx);
        ctx.ui.notify("pi-statusline: включён ✓", "info");
        return;
      }
      if (cmd === "off") {
        enabled = false; saveEnabled(false);
        // Пустой футер — встроенный НЕ возвращаем
        ctx.ui.setFooter((_tui, _theme) => ({
          render(_width: number): string[] { return []; },
          invalidate() {},
        }));
        ctx.ui.notify("pi-statusline: выключен", "info");
        return;
      }
      if (cmd === "reset") {
        sesIn = sesOut = sesCost = 0;
        tIn = tOut = tCost = 0;
        lastMs = null; answered = false;
        refresh(ctx);
        ctx.ui.notify("pi-statusline: счётчики сброшены ✓", "info");
        return;
      }

      // toggle
      enabled = !enabled; saveEnabled(enabled);
      if (enabled) {
        refresh(ctx);
        ctx.ui.notify("pi-statusline: включён ✓", "info");
      } else {
        ctx.ui.setFooter((_tui, _theme) => ({
          render(_width: number): string[] { return []; },
          invalidate() {},
        }));
        ctx.ui.notify("pi-statusline: выключен", "info");
      }
    },
  });
}
