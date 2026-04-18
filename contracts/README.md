# Soroban contracts (Rust)

This folder holds **Stellar Soroban** smart contracts written in **Rust**. The game still runs on the **Node + Horizon** path by default; the contract here is a **scaffold** you can grow (escrow, deeds, auctions) and call with `stellar contract invoke` or the JS SDK.

## What you need to install

1. **Rust** via [rustup](https://rustup.rs/) (stable is fine; match `rust-version` in `sm-monopoly/Cargo.toml` if builds fail).
2. **Wasm target** (required for Soroban):

   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **Stellar CLI** (build, optimize, deploy, invoke — recommended by Stellar):

   - Install: [Stellar Docs — Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/stellar-cli)
   - Confirm: `stellar --version`

4. **Optional:** Docker (some `stellar contract` flows use containers for reproducible builds — follow current CLI docs).

## Build (from repo root)

```bash
cd contracts/sm-monopoly
cargo build --target wasm32-unknown-unknown --release
```

Or, if you use the Stellar CLI wrapper:

```bash
cd contracts/sm-monopoly
stellar contract build
```

## Test

```bash
cd contracts/sm-monopoly
cargo test
```

## Deploy / invoke (outline)

Exact flags depend on your network (testnet/futurenet) and identity:

1. Create / fund a deployer account on the target network.
2. `stellar contract deploy …` (see `stellar contract deploy --help` for the current interface).
3. Save the **contract ID** in server env or DB when you wire the game to Soroban.
4. From JS, use `@stellar/stellar-sdk` **Soroban** APIs to `invokeContract` once you map game actions to contract functions.

## What to add next (game design)

When you are ready to enforce rules on-chain, extend `SmMonopoly` with things like:

- **Escrow**: hold XLM per room until `buy` / `rent` / `tax` settles.
- **Property ledger**: map `(room_id, cell_id) → owner` instead of only in server memory.
- **Auction**: timed bids stored in contract storage.
- **Admin / host**: `Address` passed at `__constructor` or `init` (pattern depends on Soroban version).

Keep the **server** as matchmaker + WebSocket hub even with Soroban; the contract then becomes the source of truth for money and title.
