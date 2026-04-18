#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

/// Soroban smart contract (Rust) — **stub** for future on-chain rules.
///
/// Today the game authorizes XLM via the Node server and Horizon memos (`SM-BUY-…`, etc.).
/// Later you can move balances, property deeds, or auction state here and invoke from the server or clients.
#[contract]
pub struct SmMonopoly;

#[contractimpl]
impl SmMonopoly {
    /// Schema / build identity for tooling and integration tests.
    pub fn version(_env: Env) -> u32 {
        1
    }
}
