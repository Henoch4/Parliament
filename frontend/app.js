import * as ethers from 'ethers';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

const PROJECT_ID = 'f018499b1e4a94d961ab67aeeeff3254';

const botTestnet = {
  id: 968, chainNamespace: 'eip155', caipNetworkId: 'eip155:968',
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'BOT Scan', url: 'https://scan.bohr.life' } },
};
const botMainnet = {
  id: 677, chainNamespace: 'eip155', caipNetworkId: 'eip155:677',
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: { default: { name: 'BOT Scan', url: 'https://scan.botchain.ai' } },
};

const modal = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [botTestnet, botMainnet],
  defaultNetwork: botMainnet,
  projectId: PROJECT_ID,
  metadata: { name: 'Parliament', description: 'Governance on BOT Chain', url: location.origin, icons: [location.origin + '/logo.png'] },
  themeVariables: { '--w3m-accent': '#8b5cf6' },
  features: { analytics: false },
});

let signer = null;
let account = null;
let walletProvider = null;
let _connectResolve = null;

const $ = (id) => document.getElementById(id);

function getProvider() {
  if (walletProvider) return walletProvider;
  try {
    if (modal && typeof modal.getWalletProvider === 'function') {
      const p = modal.getWalletProvider('eip155') || modal.getWalletProvider();
      if (p) { walletProvider = p; return p; }
    }
  } catch (e) {}
  return null;
}

async function syncFromProvider(wp) {
  let bp = new ethers.BrowserProvider(wp);
  signer = await bp.getSigner();
  account = await signer.getAddress();
  $('connectBtn').textContent = account.slice(0, 6) + '...' + account.slice(-4);
  console.log('[Parliament] Wallet connected:', account);
  if (typeof refreshReads === 'function') refreshReads();
}

function updateConnectedUI() {
  $('connectBtn').textContent = account ? account.slice(0, 6) + '...' + account.slice(-4) : 'Connect wallet';
}

function updateDisconnectedUI() {
  $('connectBtn').textContent = 'Connect wallet';
}

async function connect() {
  try {
    if (modal.getIsConnectedState()) {
      const wp = getProvider();
      if (wp) {
        await syncFromProvider(wp);
        updateConnectedUI();
        return true;
      }
    }
  } catch (err) {}
  const pending = new Promise((resolve) => { _connectResolve = resolve; });
  try { modal.open(); } catch (err) { _connectResolve = null; return false; }
  const timeout = new Promise((resolve) => setTimeout(() => resolve(!!signer), 120000));
  return Promise.race([pending, timeout]);
}

function onConnectClick() {
  let isConn = false;
  try { isConn = modal.getIsConnectedState(); } catch (e) {}
  if (isConn && getProvider()) {
    try { modal.open({ view: 'Account' }); } catch (e) { try { modal.open(); } catch (_) {} }
    return;
  }
  connect();
}

modal.subscribeProviders((state) => {
  if (state && state['eip155']) walletProvider = state['eip155'];
});

modal.subscribeAccount(async (state) => {
  if (state && state.isConnected && state.address) {
    account = state.address;
    const wp = getProvider();
    if (wp) {
      try {
        await syncFromProvider(wp);
        updateConnectedUI();
      } catch (e) {}
    }
    if (_connectResolve) { _connectResolve(!!signer); _connectResolve = null; }
  } else {
    const was = !!account;
    account = null; signer = null;
    updateDisconnectedUI();
    if (was) console.log('[Parliament] disconnected');
    if (_connectResolve) { _connectResolve(false); _connectResolve = null; }
  }
});

modal.subscribeState((state) => {
  if (state && state.open === false && _connectResolve && !signer) {
    _connectResolve(false); _connectResolve = null;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  $('connectBtn').addEventListener('click', (e) => { e.preventDefault(); onConnectClick(); });
  $('netSel').addEventListener('change', (e) => {
    const id = parseInt(e.target.value);
    modal.switchNetwork(id === 677 ? botMainnet.caipNetworkId : botTestnet.caipNetworkId);
  });
  setTimeout(async () => {
    try {
      if (!signer && modal.getIsConnectedState()) {
        const wp = getProvider();
        if (wp) {
          await syncFromProvider(wp);
          updateConnectedUI();
        }
      }
    } catch (e) {}
  }, 800);
});

// ---- mainnet contract (BOT Chain 677) ----
const WBOT = '0xD5452816194a3784dBa983426cCe7c122F4abd30';
const CONTRACT_ADDR = '0xc9A638d50Af3C969E6E940C38d1cAa611863B327';
const DEPLOY_BLOCK = 26069093;
const VOTING_PERIOD = 3 * 86400;
const EXECUTION_DELAY = 1 * 86400;
const QUORUM = 100n;
const GAS = { gasPrice: ethers.parseUnits('20', 'gwei') };
const readProvider = new ethers.JsonRpcProvider('https://rpc.botchain.ai');
const PARLIAMENT_ABI = [
  'function proposalCount() view returns (uint256)',
  'function getProposal(uint256) view returns (tuple(address proposer,string description,address target,uint256 value,bytes callData,uint256 forVotes,uint256 againstVotes,uint256 startTime,uint256 eta,bool executed,bool canceled))',
  'function hasVoted(uint256,address) view returns (bool)',
  'function createProposal(string,address,uint256,bytes)',
  'function castVote(uint256,bool)',
  'function executeProposal(uint256)',
  'function depositTreasury(uint256)',
];
const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function deposit() payable',
  'function balanceOf(address) view returns (uint256)',
];
const fmtBot = (v) => {
  const n = Number(ethers.formatEther(v));
  if (n === 0) return '0 BOT';
  if (n >= 10000) return Math.round(n).toLocaleString() + ' BOT';
  if (n >= 1) return n.toFixed(3) + ' BOT';
  return n.toFixed(5) + ' BOT';
};
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

function parlRead() { return new ethers.Contract(CONTRACT_ADDR, PARLIAMENT_ABI, readProvider); }

let votersCache = null;
async function countVoters() {
  if (votersCache !== null) return votersCache;
  try {
    const c = parlRead();
    const evs = await c.queryFilter(c.interface.getEvent('VoteCast'), DEPLOY_BLOCK);
    votersCache = new Set(evs.map((e) => e.args[1])).size;
  } catch { votersCache = 0; }
  return votersCache;
}

function proposalStatus(p, now) {
  if (p.canceled) return { text: 'Canceled', kind: 'dead' };
  if (p.executed) return { text: 'Executed', kind: 'done' };
  if (now <= Number(p.startTime) + VOTING_PERIOD) return { text: 'Voting open', kind: 'open' };
  const passed = p.forVotes > p.againstVotes && p.forVotes + p.againstVotes >= QUORUM;
  if (now <= Number(p.startTime) + VOTING_PERIOD + EXECUTION_DELAY) {
    return { text: 'Timelock — execution delay', kind: 'lock' };
  }
  return passed ? { text: 'Passed — ready to execute', kind: 'ready' } : { text: 'Defeated', kind: 'dead' };
}

async function renderProposals() {
  const box = $('proposalList');
  try {
    const c = parlRead();
    const count = Number(await c.proposalCount());
    $('statProposals').textContent = String(count);
    if (count === 0) {
      box.innerHTML = '<div class="feed-empty">No proposals yet — table the first one using the form below.</div>';
      return;
    }
    const ids = [];
    for (let i = count - 1; i >= 0 && ids.length < 25; i--) ids.push(i);
    const [props, votedFlags] = await Promise.all([
      Promise.all(ids.map((i) => c.getProposal(i))),
      account ? Promise.all(ids.map((i) => c.hasVoted(i, account))) : Promise.all(ids.map(() => null)),
    ]);
    const now = Math.floor(Date.now() / 1000);
    box.innerHTML = '';
    ids.forEach((id, k) => {
      const p = props[k];
      const st = proposalStatus(p, now);
      const total = p.forVotes + p.againstVotes;
      const pct = total > 0n ? Math.round((Number(p.forVotes) / Number(total)) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'proposal-row';
      row.innerHTML =
        '<div class="top"><span class="idx">#' + id + ' · ' + esc(st.text) + '</span><span class="idx">' + short(p.proposer) + '</span></div>' +
        '<h4>' + esc(p.description) + '</h4>' +
        '<div class="votebar"><div class="for" style="width:' + pct + '%"></div></div>' +
        '<div class="votes"><span class="for-n">FOR ' + fmtBot(p.forVotes) + '</span><span class="ag-n">AGAINST ' + fmtBot(p.againstVotes) + '</span></div>';
      const btns = document.createElement('div');
      btns.style.marginTop = '10px';
      btns.style.display = 'flex';
      btns.style.gap = '8px';
      const votingOpen = st.kind === 'open';
      const already = votedFlags[k] === true;
      const mk = (text, cls, label, disabled, fn) => {
        const b = document.createElement('button');
        b.className = 'btn ' + cls;
        b.textContent = text;
        b.disabled = disabled;
        b.addEventListener('click', () => runTx(b, label, fn));
        btns.appendChild(b);
        return b;
      };
      if (account) {
        mk('Vote For', 'btn-primary', 'Voted', !votingOpen || already, () =>
          parlRead().connect(signer).castVote(id, true, GAS));
        mk('Vote Against', 'btn-ghost', 'Voted', !votingOpen || already, () =>
          parlRead().connect(signer).castVote(id, false, GAS));
        if (st.kind === 'ready') {
          mk('Execute', 'btn-primary', 'Executed', false, () =>
            parlRead().connect(signer).executeProposal(id, GAS));
        }
      }
      row.appendChild(btns);
      box.appendChild(row);
    });
  } catch (e) { console.error('[Parliament] proposals failed', e); }
}

async function refreshReads() {
  try {
    const [count, treasury, voters] = await Promise.all([
      parlRead().proposalCount(),
      new ethers.Contract(WBOT, ERC20_ABI, readProvider).balanceOf(CONTRACT_ADDR),
      countVoters(),
    ]);
    $('statProposals').textContent = String(Number(count));
    $('statTreasury').textContent = fmtBot(treasury);
    $('treasuryBalance').textContent = fmtBot(treasury);
    $('statVoters').textContent = String(voters);
    if (account) {
      const bal = await new ethers.Contract(WBOT, ERC20_ABI, readProvider).balanceOf(account);
      $('yourPower').textContent = fmtBot(bal);
    } else {
      $('yourPower').textContent = 'connect wallet';
    }
    await renderProposals();
  } catch (e) { console.error('[Parliament] reads failed', e); }
}

async function requireWallet() {
  if (signer && account) return true;
  const ok = await connect();
  return !!(ok && signer && account);
}

async function ensureWbot(amount) {
  const t = new ethers.Contract(WBOT, ERC20_ABI, signer);
  const bal = await t.balanceOf(account);
  if (bal >= amount) return;
  const shortfall = amount - bal;
  const native = await signer.provider.getBalance(account);
  const gasCost = ethers.parseEther('0.005');
  if (native < shortfall + gasCost) throw new Error('Need ' + ethers.formatEther(shortfall + gasCost - native).slice(0, 7) + ' more BOT (wrap + gas)');
  const tx = await t.deposit({ value: shortfall, ...GAS });
  await tx.wait();
}

async function approveIfNeeded(amount) {
  const t = new ethers.Contract(WBOT, ERC20_ABI, signer);
  const a = await t.allowance(account, CONTRACT_ADDR);
  if (a < amount) {
    const tx = await t.approve(CONTRACT_ADDR, ethers.MaxUint256, GAS);
    await tx.wait();
  }
}

async function runTx(btn, label, fn) {
  if (!(await requireWallet())) return;
  const old = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Confirm in wallet…'; }
  try {
    const tx = await fn();
    if (btn) btn.textContent = 'Pending…';
    await tx.wait();
    if (btn) btn.textContent = '✓ ' + label;
    await refreshReads();
  } catch (e) {
    console.error('[Parliament]', label, e);
    if (btn) btn.textContent = '✗ ' + String(e.shortMessage || e.reason || e.message || 'failed').slice(0, 50);
  }
  if (btn) setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 3500);
}

function parseAmt(input) {
  try {
    const v = ethers.parseUnits((input.value || '').trim() || '0', 18);
    return v > 0n ? v : null;
  } catch { return null; }
}

document.addEventListener('DOMContentLoaded', () => {
  $('contractAddr').textContent = CONTRACT_ADDR;
  refreshReads();
  setInterval(refreshReads, 45000);

  const createBtn = $('createPropBtn'), voteBtn = $('voteBtn'), depBtn = $('depositTreasuryBtn');
  [createBtn, voteBtn, depBtn].forEach((b) => { b.dataset.label = b.textContent; });
  const guard = (btn, text) => { btn.textContent = text; setTimeout(() => { btn.textContent = btn.dataset.label; }, 1500); };

  createBtn.addEventListener('click', async () => {
    const desc = ($('propDesc').value || '').trim();
    const target = ($('propTarget').value || '').trim();
    if (!desc) { guard(createBtn, 'Add a description'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(target)) { guard(createBtn, 'Target must be a 0x address'); return; }
    let value = 0n;
    try { value = ethers.parseUnits(($('propValue').value || '0').trim() || '0', 18); } catch { guard(createBtn, 'Bad value'); return; }
    runTx(createBtn, 'Tabled', () => parlRead().connect(signer).createProposal(desc, target, value, '0x', GAS));
  });

  voteBtn.addEventListener('click', () => {
    const id = parseInt($('voteId').value, 10);
    if (Number.isNaN(id) || id < 0) { guard(voteBtn, 'Enter proposal ID'); return; }
    const support = $('voteChoice').value === 'true';
    runTx(voteBtn, 'Vote counted', () => parlRead().connect(signer).castVote(id, support, GAS));
  });

  depBtn.addEventListener('click', () => {
    const amt = parseAmt($('treasuryAmt'));
    if (!amt) { guard(depBtn, 'Enter amount'); return; }
    runTx(depBtn, 'Deposited', async () => {
      await ensureWbot(amt);
      await approveIfNeeded(amt);
      return parlRead().connect(signer).depositTreasury(amt, GAS);
    });
  });
});
