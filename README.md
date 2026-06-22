# MyMate

MyMate is a V1 AI companion platform scaffold focused on persistent memory, relationship growth, mood, companion evolution, guided agent workflows, and future-ready blockchain and 0G Storage boundaries.

## Quick Start

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The app runs at `http://localhost:3000`.

## What Is Implemented

- Privy sign up/login starter page with email, wallet login, and embedded wallet creation.
- Wallet identity passed into companion APIs from the authenticated Privy account.
- Companion creation with four companion archetypes.
- Prisma schema for users, companions, memories, profiles, activities, chats, and memory snapshots.
- AI chat route with in-character system prompt, recent chat context, important memories, relationship updates, memory extraction, personality adaptation, workflow completion, and evolution checks.
- Activity route for daily check-in, feeding, reflection prompts, companion questions, and mood guessing.
- Encrypted memory snapshot service with a 0G Storage adapter boundary.
- CompanionRegistry Solidity contract for ownership and evolution milestones.
- Responsive dashboard and companion interaction UI.

Provider credentials are optional during local development. Without an LLM key or 0G configuration, deterministic local fallbacks keep the core workflow usable.

## Authentication

The first screen is a dedicated starter page powered by Privy. Set `NEXT_PUBLIC_PRIVY_APP_ID` in `.env`, then users can sign up or log in with email or wallet. Privy creates embedded wallets for users who do not already have one, and the dashboard uses that wallet address for companion ownership.

## 0G Storage

Memory snapshots are generated from important memories, relationship scores, and personality state. The snapshot JSON is encrypted locally with `MEMORY_ENCRYPTION_KEY`, then uploaded through the 0G TypeScript SDK from `lib/zero-g/storage.ts`.

The adapter follows the SDK pattern for in-memory uploads:

- build a `MemData` object from the encrypted snapshot bytes
- calculate the Merkle tree before upload
- create an `Indexer` with `ZERO_G_INDEXER_RPC`
- sign with an `ethers.Wallet` connected to `ZERO_G_EVM_RPC`
- call `indexer.upload(...)` with AES-256 upload encryption enabled
- store the returned `rootHash` in `memory_snapshots`

Required 0G environment variables:

```bash
ZERO_G_EVM_RPC="https://evmrpc-testnet.0g.ai"
ZERO_G_INDEXER_RPC="https://indexer-storage-testnet-turbo.0g.ai"
ZERO_G_STORAGE_PRIVATE_KEY="..."
ZERO_G_STORAGE_ENCRYPTION_KEY="base64-encoded-32-byte-key"
```

If those are missing, the API returns a deterministic `local-*` root hash so development can continue without uploading private memory data.
