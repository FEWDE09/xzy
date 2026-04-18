# Stellar Monopoly

A multiplayer Monopoly-style board game where **Stellar Lumens (XLM)** move on-chain for purchases, rent, and taxes. The UI uses **React + Vite + Tailwind**, the game server uses **Express + Socket.IO**, and wallets connect through **Freighter**.

## Prerequisites

- Node.js 20+
- [Freighter](https://www.freighter.app/) browser extension
- Stellar **testnet** XLM for players (friendbot) and a **bank** account for the server

## Play solo vs CPU

In the lobby, the host can click **Add CPU player** to fill seats (up to 6 total). You need at least one human and **two players total** to start — e.g. you + one CPU. Bots take turns automatically; their buys/rents/taxes are simulated on the server. When **you** owe rent to a CPU landlord, you pay **XLM to the game bank** (`BANK_PUBLIC_KEY`) with a `SM-RENT-BOT-…` memo so Horizon verification still matches.

## Quick start

```bash
cd stellar-monopoly
npm install
npm run dev
```

This runs the API on port **3847** and the Vite app on **5173** (see root `package.json` scripts).

**Do not run only `vite` for the client** unless the game API is already listening on **3847** — Add CPU and health checks call `http://127.0.0.1:3847` in dev. Use **`npm run dev`** from the repo root so both processes start.

### “Failed running index.js” / port already in use

The API must own **port 3847**. If a previous run did not exit, you get **`EADDRINUSE`**. Free the port, then start again:

```bash
npx --yes kill-port 3847
cd stellar-monopoly/server && npm start
```

In Cursor/VS Code, open the **`stellar-monopoly`** folder (not your home directory) and use **Run and Debug → “Stellar Monopoly: API server”** so `cwd` is `server/`. Running `index.js` from the wrong folder or twice causes this.

Configure the server (copy `server/.env.example` to `server/.env`):

| Variable | Purpose |
|----------|---------|
| `BANK_PUBLIC_KEY` | Receives property payments and taxes (must exist on the chosen network) |
| `TREASURY_SECRET` | Optional; pays Pass GO / Chance rewards to players |
| `DEMO_SKIP_CHAIN=1` | Enables “Demo buy” without an on-chain purchase (local testing only) |

Memos are verified on-chain (`SM-BUY-…`, `SM-RENT-…`, `SM-TAX-…`, etc.).

## Optional: Soroban

Rent formulas and ownership can be enforced in **Soroban** contracts later; the current server validates payments via **Horizon** and keeps authoritative game state in memory.

## Project layout

- `client/` — React UI (`GameBoard`, `DiceRoller`, `WalletPanel`, `TransactionFeed`, `Leaderboard`, …)
- `server/` — rooms, turn logic, Horizon verification, optional treasury payouts
# xzy
