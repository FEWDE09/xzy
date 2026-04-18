export type GamePhase = 'lobby' | 'playing' | 'ended'

export type BoardCell = {
  id: number
  type: string
  name: string
  price?: number
  rent?: number
  color?: string
  taxAmount?: number
  group?: string
  gridRow?: number
  gridCol?: number
}

export type Pending =
  | {
      kind: 'buy_offer'
      cellId: number
      playerId: string
      price: number
      rent: number
      rentNote?: string
    }
  | {
      kind: 'pay_rent'
      cellId: number
      payerId: string
      payeeId: string
      payeeKey?: string
      amount: number
      landlordIsBot?: boolean
    }
  | { kind: 'pay_tax'; cellId: number; playerId: string; amount: number; label?: string }
  | { kind: 'pass_go_reward'; playerId: string; amount: number }
  | { kind: 'chance_gain'; playerId: string; amount: number; memo?: string }
  | { kind: 'message'; text: string }
  | { kind: 'chance_followup'; playerId: string }
  | null

export type GamePlayer = {
  id: string
  name: string
  publicKey: string
  position: number
  inJail: boolean
  properties: number[]
  disconnected: boolean
  isBot?: boolean
}

export type GameState = {
  id: string
  phase: GamePhase
  hostId: string
  players: GamePlayer[]
  spectators: { id: string; name: string }[]
  turnIndex: number
  currentPlayerId?: string
  pending: Pending
  lastDice: { d1: number; d2: number; total: number } | null
  lastChance: { text: string; effect: string; deck?: string } | null
  ownership: Record<string, string>
  diceRolled: boolean
  board: BoardCell[]
  movementPath: { playerId: string; path: number[]; from: number } | null
  winnerId: string | null
}

export type LeaderboardRow = {
  id: string
  name: string
  propertiesOwned: number
  propertyValue: number
  position: number
}
