import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const NETWORK = process.env.STELLAR_NETWORK || 'testnet';

const horizonUrls = {
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
  pubnet: 'https://horizon.stellar.org',
};

export const horizonUrl = horizonUrls[NETWORK] || horizonUrls.testnet;
export const server = new StellarSdk.Horizon.Server(horizonUrl);

export function getNetworkPassphrase() {
  if (NETWORK === 'pubnet') return StellarSdk.Networks.PUBLIC;
  if (NETWORK === 'futurenet') return StellarSdk.Networks.FUTURENET;
  return StellarSdk.Networks.TESTNET;
}

export const bankPublicKey = process.env.BANK_PUBLIC_KEY || '';
export const treasurySecret = process.env.TREASURY_SECRET || '';

/**
 * Minimum native XLM balance (Horizon) to create a room or join as a new player.
 * Default 800: covers Boardwalk-class buy (~400), Income Tax (100), Luxury (75),
 * a heavy railroad rent (160), and a small buffer for fees / multiple charges.
 * Override with MIN_JOIN_BALANCE_XLM (use 0 to allow any balance without SKIP_JOIN_BALANCE_CHECK).
 * Balance gating is **off by default**. Enable it by setting ENABLE_JOIN_BALANCE_CHECK=1.
 * Set SKIP_JOIN_BALANCE_CHECK=1 to skip the Horizon call entirely.
 */
export function getMinJoinBalanceXlm() {
  const v = process.env.MIN_JOIN_BALANCE_XLM;
  if (v === undefined || v === '') return 800;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 800;
}

export function isJoinBalanceCheckEnabled() {
  if (process.env.SKIP_JOIN_BALANCE_CHECK === '1') return false;
  return process.env.ENABLE_JOIN_BALANCE_CHECK === '1';
}

/** @returns {Promise<{ ok: true; xlm: number } | { ok: false; error: string }>} */
export async function fetchNativeXlmBalance(publicKey) {
  try {
    const account = await server.accounts().accountId(publicKey).call();
    const native = account.balances.find((b) => b.asset_type === 'native');
    const raw = native ? parseFloat(String(native.balance)) : 0;
    const xlm = Number.isFinite(raw) ? raw : 0;
    return { ok: true, xlm };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404) {
      return { ok: true, xlm: 0 };
    }
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Gate for lobby entry (create room / new join). Reconnecting an existing seat skips this.
 * @returns {Promise<{ ok: true; skipped?: boolean; balance?: number; required: number } | { ok: false; error: string; balance?: number; required: number }>}
 */
export async function assertSufficientJoinBalance(publicKey) {
  const required = getMinJoinBalanceXlm();
  if (!isJoinBalanceCheckEnabled() || required <= 0) {
    return { ok: true, skipped: true, required };
  }
  if (!publicKey || typeof publicKey !== 'string' || !StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    return { ok: false, error: 'Invalid Stellar public key.', required };
  }
  const res = await fetchNativeXlmBalance(publicKey);
  if (!res.ok) {
    return {
      ok: false,
      error: `Could not verify wallet balance (${res.error}). Horizon: ${horizonUrl}`,
      required,
    };
  }
  if (res.xlm < required) {
    return {
      ok: false,
      error: `You need at least ${required} XLM in this wallet to create or join a game (balance: ${res.xlm.toFixed(4)} XLM). Fund the account on ${NETWORK} or lower MIN_JOIN_BALANCE_XLM / set SKIP_JOIN_BALANCE_CHECK=1 for local testing.`,
      balance: res.xlm,
      required,
    };
  }
  return { ok: true, balance: res.xlm, required };
}

/**
 * Verify native XLM payment in a transaction.
 * @param {string} txHash
 * @param {{ amountXlm: number; from: string; to: string; memo?: string }} expected
 */
export async function verifyPaymentTx(txHash, expected) {
  const tx = await server.transactions().transaction(txHash).call();
  const opsResponse = await server.operations().forTransaction(txHash).call();
  const records = opsResponse.records || [];
  const amountStr = expected.amountXlm.toFixed(7);

  let memoText = '';
  if (tx.memo_type === 'text' && tx.memo) {
    try {
      memoText = Buffer.from(tx.memo, 'base64').toString('utf8');
    } catch {
      memoText = String(tx.memo);
    }
  } else if (typeof tx.memo === 'string' && tx.memo_type !== 'hash') {
    memoText = tx.memo;
  }

  for (const op of records) {
    if (op.type !== 'payment') continue;
    if (op.asset_type !== 'native') continue;
    const from = op.source_account || op.from;
    const to = op.to;
    if (from !== expected.from || to !== expected.to) continue;
    if (parseFloat(String(op.amount)).toFixed(7) !== amountStr) continue;
    if (expected.memo) {
      const short = expected.memo.slice(0, 28);
      if (!memoText.includes(short)) {
        continue;
      }
    }
    return { ok: true, ledger: tx.ledger, tx };
  }

  return { ok: false, error: 'No matching native payment' };
}

export async function sendTreasuryPayment(toPublicKey, amountXlm, memo) {
  if (!treasurySecret) {
    return { ok: false, error: 'Treasury not configured (set TREASURY_SECRET)' };
  }
  const kp = StellarSdk.Keypair.fromSecret(treasurySecret);
  const source = await server.loadAccount(kp.publicKey());
  const fee = (await server.fetchBaseFee()).toString();
  const tx = new StellarSdk.TransactionBuilder(source, {
    fee,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: toPublicKey,
        asset: StellarSdk.Asset.native(),
        amount: amountXlm.toFixed(7),
      }),
    )
    .addMemo(memo ? StellarSdk.Memo.text(String(memo).slice(0, 28)) : StellarSdk.Memo.none())
    .setTimeout(180)
    .build();

  tx.sign(kp);
  const result = await server.submitTransaction(tx);
  return { ok: true, hash: result.hash, result };
}
