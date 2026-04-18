import * as StellarSdk from '@stellar/stellar-sdk'
import { signTransaction } from '@stellar/freighter-api'

const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet'

const horizonUrls: Record<string, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
  pubnet: 'https://horizon.stellar.org',
}

export const horizonUrl = horizonUrls[NETWORK] || horizonUrls.testnet

export function getNetworkPassphrase() {
  if (NETWORK === 'pubnet') return StellarSdk.Networks.PUBLIC
  if (NETWORK === 'futurenet') return StellarSdk.Networks.FUTURENET
  return StellarSdk.Networks.TESTNET
}

const server = new StellarSdk.Horizon.Server(horizonUrl)

export async function fetchXlmBalance(publicKey: string): Promise<string> {
  try {
    const acc = await server.loadAccount(publicKey)
    const native = acc.balances.find((b: { asset_type?: string }) => b.asset_type === 'native')
    return native ? (native as { balance: string }).balance : '0'
  } catch {
    return '0'
  }
}

export async function signAndSubmitPayment(params: {
  sourcePublicKey: string
  destination: string
  amountXlm: number
  memo: string
}): Promise<{ hash: string }> {
  const { sourcePublicKey, destination, amountXlm, memo } = params
  const account = await server.loadAccount(sourcePublicKey)
  const fee = (await server.fetchBaseFee()).toString()
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: StellarSdk.Asset.native(),
        amount: amountXlm.toFixed(7),
      }),
    )
    .addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
    .setTimeout(180)
    .build()

  const xdr = tx.toXDR()
  const signed = await signTransaction(xdr, {
    networkPassphrase: getNetworkPassphrase(),
    address: sourcePublicKey,
  })

  if (signed.error || !signed.signedTxXdr) {
    throw new Error(signed.error?.message || 'Freighter rejected transaction')
  }

  const built = StellarSdk.TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    getNetworkPassphrase(),
  )
  const result = await server.submitTransaction(built)
  return { hash: result.hash }
}
