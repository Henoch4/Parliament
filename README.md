# Parliament — Governance on BOT Chain

Table proposals, vote with your WBOT balance, manage a community treasury.
3-day voting period, 100-vote quorum, 1-day execution delay — all enforced on-chain.

## Networks
- Testnet — chainId 968 — RPC https://rpc.bohr.life — explorer https://scan.bohr.life
- Mainnet — chainId 677 — RPC https://rpc.botchain.ai — explorer https://scan.botchain.ai

## Deployments
- Mainnet (677): **deployed** — `0xc9A638d50Af3C969E6E940C38d1cAa611863B327` (block 26069093, tx `0x07a2d89a62b6a33c21ab1e7c29db06bd12d7662328b6db3b35ca6d1a8424a833`, 20 gwei, gasUsed 1581001, 2026-10-09). Frontend wired and defaults to mainnet.
- Constructor: WBOT `0xD5452816194a3784dBa983426cCe7c122F4abd30` (governance + treasury token).

## Rules
- Voting power = WBOT balance, synced at propose/vote time
- Proposal threshold 1000 · quorum 100 · voting 3 days · execution delay 1 day
- Treasury deposits are ERC-20; withdrawals require owner (handover: team Safe)

## Structure
- `frontend/` — static dApp (index.html + app.js). Wallet connect via Reown/AppKit, chain switch to mainnet 677.
- `contracts/Parliament.sol` — createProposal / castVote / execute / cancel / depositTreasury.

## Run frontend
Serve the folder over HTTP (ES modules don't load from `file://`):
```
npx serve frontend
```

## Team Safe (2-of-2, all projects)
- Safe: `0x3f6599D5694044Ac0B357695843391220a5aE0c3` — owners `0x79d0…9188` + `0x7765…5D82`, threshold 2.
