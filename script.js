/* ╔══════════════════════════════════════════════════════════╗
   ║  SISTEMA DE RIFA — script.js (Firebase Firestore)        ║
   ╚══════════════════════════════════════════════════════════╝ */

/* ──────────────────────────────────────────────────────────
   FIREBASE INIT
   ⚠️ No Firebase Console → Firestore → Regras, use:
      allow read, write: if true;
────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyBw47mMR1hgGXrgheophXw1ZMrY45oG3GU",
  authDomain:        "rifa-4238b.firebaseapp.com",
  projectId:         "rifa-4238b",
  storageBucket:     "rifa-4238b.firebasestorage.app",
  messagingSenderId: "530775070451",
  appId:             "1:530775070451:web:f961b722dd5d23887e8986",
  measurementId:     "G-QFD50WQ860"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
firebase.analytics();

const configDoc       = db.doc('config/main');
const participantsCol = db.collection('participants');
const drawHistoryCol  = db.collection('drawHistory');

/* ──────────────────────────────────────────────────────────
   ESTADO GLOBAL
────────────────────────────────────────────────────────── */
let state = {
  config:       null,
  numbers:      {},   // { [n]: { status: 'available'|'pending'|'paid' } }
  participants: [],   // { id (Firestore), name, phone, numbers[], paymentStatus, date }
  drawHistory:  [],   // { id (Firestore), number, name, phone, prize, date, timestamp }
  selected:     [],
  adminLoggedIn: false,
  editingNums:  [],
  _adminClickCount: 0,
  _adminClickTimer: null,
  _pendingBuyer: null,
};

/* ──────────────────────────────────────────────────────────
   LISTENERS FIRESTORE (tempo real — substitui localStorage)
────────────────────────────────────────────────────────── */
function setupListeners() {
  configDoc.onSnapshot(doc => {
    if (doc.exists) {
      const d     = doc.data();
      state.config  = d.config  || null;
      state.numbers = d.numbers || {};
    } else {
      state.config  = null;
      state.numbers = {};
    }
    renderUI();
    if (state.adminLoggedIn) updateAdminStats();
  }, err => { console.error('Config:', err); toast('Erro de conexão com o banco.', 'error'); });

  participantsCol.onSnapshot(snapshot => {
    state.participants = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    renderUI();
    if (state.adminLoggedIn) { updateAdminStats(); renderRequests(); renderBuyers(); }
  }, err => console.error('Participants:', err));

  drawHistoryCol.onSnapshot(snapshot => {
    state.drawHistory = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    if (state.adminLoggedIn) renderDrawHistory();
  }, err => console.error('DrawHistory:', err));
}

/* ──────────────────────────────────────────────────────────
   INICIALIZAÇÃO
────────────────────────────────────────────────────────── */
function init() {
  setupListeners();
  setupAdminSecretClick();
}

function setupAdminSecretClick() {
  document.getElementById('header-brand-click').addEventListener('click', () => {
    if (state.adminLoggedIn) return;
    clearTimeout(state._adminClickTimer);
    state._adminClickCount++;
    state._adminClickTimer = setTimeout(() => { state._adminClickCount = 0; }, 2000);
    if (state._adminClickCount >= 5) {
      state._adminClickCount = 0;
      openAdminLogin();
    }
  });
}

/* ──────────────────────────────────────────────────────────
   RENDER GERAL
────────────────────────────────────────────────────────── */
function renderUI() {
  const has = !!state.config;

  el('screen-coming-soon').style.display  = (!has && !state.adminLoggedIn) ? 'block' : 'none';
  el('raffle-info').style.display         = has ? 'block' : 'none';
  el('controls').style.display            = has ? 'flex'  : 'none';
  el('random-picker-card').style.display  = has ? 'block' : 'none';
  el('organizers-card').style.display     = has ? 'flex'  : 'none';
  el('header-admin-bar').style.display    = state.adminLoggedIn ? 'flex' : 'none';


  // Campos do info card visíveis apenas para o admin
  document.querySelectorAll('.admin-only-info').forEach(el => {
    el.style.display = state.adminLoggedIn ? 'block' : 'none';
  });

  if (has) { renderInfoCard(); renderGrid(); }
  else el('numbers-grid').innerHTML = '';
}

/* ──────────────────────────────────────────────────────────
   INFO CARD
────────────────────────────────────────────────────────── */
function renderInfoCard() {
  if (!state.config) return;
  const total    = state.config.total;
  const pending  = countByStatus('pending');
  const paid     = countByStatus('paid');
  const available = total - pending - paid;
  const earned   = paid * state.config.price;

  el('info-price').textContent     = fmtCurrency(state.config.price);
  el('info-total').textContent     = total;
  el('info-available').textContent = available;
  el('info-pending').textContent   = pending;
  el('info-paid').textContent      = paid;
  el('info-earned').textContent    = fmtCurrency(earned);
  el('raffle-title').textContent   = state.config.name;

  const desc = el('raffle-description');
  desc.textContent   = state.config.description || '';
  desc.style.display = state.config.description ? 'block' : 'none';
}

function countByStatus(status) {
  return Object.values(state.numbers).filter(n => n.status === status).length;
}

/* ──────────────────────────────────────────────────────────
   GRADE DE NÚMEROS
────────────────────────────────────────────────────────── */
function renderGrid() {
  const grid = el('numbers-grid');
  grid.innerHTML = '';
  const total = state.config.total;
  for (let i = 1; i <= total; i++) {
    const numData    = state.numbers[i] || { status: 'available' };
    const isSelected = state.selected.includes(i);
    const status     = isSelected ? 'selected' : numData.status;

    const btn = document.createElement('button');
    btn.className      = `number-btn ${status}`;
    btn.textContent    = String(i).padStart(2, '0');
    btn.dataset.number = i;
    btn.dataset.status = status;

    if (status === 'pending' || status === 'paid') {
      const owner = ownerOf(i);
      if (owner) btn.title = owner;
    }
    if (numData.status === 'available') {
      btn.addEventListener('click', () => toggleNumber(i, btn));
    }
    grid.appendChild(btn);
  }
}

function ownerOf(number) {
  const p = state.participants.find(p => p.numbers.includes(number));
  return p ? p.name : '';
}

/* ──────────────────────────────────────────────────────────
   SELEÇÃO DE NÚMEROS
────────────────────────────────────────────────────────── */
function toggleNumber(number, btn) {
  const idx = state.selected.indexOf(number);
  if (idx > -1) {
    state.selected.splice(idx, 1);
    btn.className = 'number-btn available'; btn.dataset.status = 'available';
  } else {
    state.selected.push(number);
    btn.className = 'number-btn selected'; btn.dataset.status = 'selected';
  }
  updatePurchaseBar();
}

function clearSelection() {
  state.selected.forEach(n => {
    const btn = document.querySelector(`[data-number="${n}"]`);
    if (btn) { btn.className = 'number-btn available'; btn.dataset.status = 'available'; }
  });
  state.selected = [];
  updatePurchaseBar();
  hideRandomResult();
}

function updatePurchaseBar() {
  const bar   = el('purchase-bar');
  const count = state.selected.length;
  if (count === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  el('selected-count').textContent =
    `${count} número${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''}`;
  el('selected-total').textContent = fmtCurrency(count * state.config.price);
}

/* ──────────────────────────────────────────────────────────
   FILTRO / BUSCA DA GRADE
────────────────────────────────────────────────────────── */
function filterNumbers() {
  const search = el('search-number').value.trim();
  const filter = el('filter-status').value;
  document.querySelectorAll('.number-btn').forEach(btn => {
    const n  = parseInt(btn.dataset.number);
    const s  = btn.dataset.status;
    const ok = (search === '' || String(n).includes(search)) &&
               (filter === 'all' || s === filter);
    btn.classList.toggle('hidden', !ok);
  });
}

/* ──────────────────────────────────────────────────────────
   SORTEIO ALEATÓRIO DE SELEÇÃO
────────────────────────────────────────────────────────── */
function pickRandomNumbers() {
  if (!state.config) return;
  const qtyEl = el('random-qty');
  const qty   = parseInt(qtyEl.value);
  if (!qty || qty < 1) { toast('Informe a quantidade.', 'error'); qtyEl.focus(); return; }

  const av = [];
  for (let i = 1; i <= state.config.total; i++) {
    if ((state.numbers[i]?.status || 'available') === 'available' && !state.selected.includes(i))
      av.push(i);
  }
  if (av.length === 0) { toast('Sem números disponíveis.', 'error'); return; }
  if (qty > av.length) {
    toast(`Apenas ${av.length} disponíve${av.length > 1 ? 'is' : 'l'}.`, 'warning'); return;
  }

  clearSelection();
  const picked = shuffleArray(av).slice(0, qty).sort((a, b) => a - b);
  picked.forEach(n => {
    state.selected.push(n);
    const btn = document.querySelector(`[data-number="${n}"]`);
    if (btn) { btn.className = 'number-btn selected'; btn.dataset.status = 'selected'; }
  });
  updatePurchaseBar();
  showRandomResult(picked);
  el('random-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showRandomResult(nums) {
  el('random-result-numbers').innerHTML =
    nums.map((n, i) =>
      `<span class="random-badge" style="animation-delay:${i * 55}ms">${pad(n)}</span>`
    ).join('');
  el('random-result').style.display = 'block';
  el('random-result').classList.remove('random-result-animate');
  void el('random-result').offsetWidth;
  el('random-result').classList.add('random-result-animate');
}

function clearRandomResult() {
  el('random-qty').value = '';
  clearSelection();
}

function hideRandomResult() {
  el('random-result').style.display = 'none';
}

/* ──────────────────────────────────────────────────────────
   FORMULÁRIO DO COMPRADOR → PIX
────────────────────────────────────────────────────────── */
function openBuyerForm() {
  if (state.selected.length === 0) { toast('Selecione ao menos um número.', 'warning'); return; }
  const sorted = [...state.selected].sort((a, b) => a - b);
  el('buyer-numbers').textContent = sorted.map(pad).join(', ');
  el('buyer-total').textContent   = fmtCurrency(sorted.length * state.config.price);
  el('buyer-name').value  = '';
  el('buyer-phone').value = '';
  openModal('modal-buyer');
}
function closeBuyerForm() { closeModal('modal-buyer'); }

function goToPix() {
  const name  = el('buyer-name').value.trim();
  const phone = el('buyer-phone').value.trim();
  if (!name)  return toast('Informe seu nome.', 'error');
  if (!phone) return toast('Informe seu WhatsApp.', 'error');
  if (phone.replace(/\D/g, '').length < 10) return toast('WhatsApp inválido.', 'error');

  if (!state.config?.pixKey) {
    toast('Chave PIX não configurada. Contate o administrador.', 'warning'); return;
  }

  const sorted    = [...state.selected].sort((a, b) => a - b);
  const conflicts = sorted.filter(n => (state.numbers[n]?.status || 'available') !== 'available');
  if (conflicts.length > 0) {
    toast(`Número(s) ${conflicts.map(pad).join(', ')} já reservado(s).`, 'error');
    conflicts.forEach(n => {
      const btn = document.querySelector(`[data-number="${n}"]`);
      if (btn) {
        btn.className = `number-btn ${state.numbers[n].status}`;
        btn.dataset.status = state.numbers[n].status;
        btn.onclick = null;
      }
    });
    state.selected = state.selected.filter(n => !conflicts.includes(n));
    updatePurchaseBar();
    return;
  }

  closeBuyerForm();

  el('pix-buyer-name').textContent     = name;
  el('pix-numbers').textContent        = sorted.map(pad).join(', ');
  el('pix-total').textContent          = fmtCurrency(sorted.length * state.config.price);
  el('pix-key-display').textContent    = state.config.pixKey;
  el('pix-holder-display').textContent = state.config.pixHolder || '';
  el('pix-bank-display').textContent   = state.config.pixBank   || '';

  const typeLabels = { cpf:'CPF', cnpj:'CNPJ', phone:'Telefone', email:'E-mail', random:'Aleatória' };
  el('pix-type-badge').textContent = typeLabels[state.config.pixKeyType] || 'PIX';

  const instrBox = el('pix-instructions-box');
  if (state.config.pixInstructions) {
    el('pix-instructions-text').textContent = state.config.pixInstructions;
    instrBox.style.display = 'block';
  } else {
    instrBox.style.display = 'none';
  }

  state._pendingBuyer = { name, phone, numbers: sorted };
  openModal('modal-pix');
}

function cancelPix() {
  state._pendingBuyer = null;
  closeModal('modal-pix');
}

function copyPixKey() {
  const key = state.config?.pixKey;
  if (!key) return;
  navigator.clipboard.writeText(key).then(() => {
    el('copy-icon').textContent = '✅';
    setTimeout(() => { el('copy-icon').textContent = '📋'; }, 2000);
    toast('Chave PIX copiada!', 'success');
  }).catch(() => {
    const t = document.createElement('textarea');
    t.value = key; document.body.appendChild(t); t.select();
    document.execCommand('copy'); document.body.removeChild(t);
    toast('Chave PIX copiada!', 'success');
  });
}

async function confirmPixPayment() {
  const buyer = state._pendingBuyer;
  if (!buyer) return;

  // Abre WhatsApp do admin ANTES do await — ainda dentro do contexto do clique do usuário
  const adminPhone = state.config?.adminWhatsapp;
  if (adminPhone) {
    const adminUrl = buildAdminNotificationUrl(buyer, adminPhone);
    window.open(adminUrl, '_blank');
  }

  try {
    const updatedNumbers = { ...state.numbers };
    buyer.numbers.forEach(n => { updatedNumbers[n] = { status: 'pending' }; });

    const batch  = db.batch();
    const newRef = participantsCol.doc();
    batch.set(configDoc, { numbers: updatedNumbers }, { merge: true });
    batch.set(newRef, {
      name:          buyer.name,
      phone:         buyer.phone,
      numbers:       buyer.numbers,
      paymentStatus: 'pending',
      date:          new Date().toLocaleDateString('pt-BR'),
      createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    state._pendingBuyer = null;
    state.selected      = [];
    closeModal('modal-pix');
    updatePurchaseBar();
    hideRandomResult();
    el('random-qty').value = '';

    // Botão de comprovante para o comprador
    const proofBtn = el('btn-buyer-proof-whatsapp');
    if (proofBtn && adminPhone) {
      proofBtn.href         = buildBuyerProofUrl(buyer, adminPhone);
      proofBtn.style.display = 'inline-flex';
    } else if (proofBtn) {
      proofBtn.style.display = 'none';
    }

    el('pix-done-message').textContent = `${buyer.name}, sua solicitação foi registrada!`;
    el('pix-done-numbers').innerHTML   =
      buyer.numbers.map(n => `<span class="confirm-number-tag">${pad(n)}</span>`).join('');
    openModal('modal-pix-done');
  } catch (err) {
    console.error('Erro ao registrar pagamento:', err);
    toast('Erro ao processar. Tente novamente.', 'error');
  }
}

function closePixDone() { closeModal('modal-pix-done'); }

/* ──────────────────────────────────────────────────────────
   CRUD DE COMPRADORES
────────────────────────────────────────────────────────── */
function getBuyers({ search = '', status = 'all' } = {}) {
  const q = search.toLowerCase();
  return state.participants.filter(p => {
    const ms = status === 'all' || p.paymentStatus === status;
    const mq = !q || p.name.toLowerCase().includes(q) ||
               p.phone.includes(q) || p.numbers.some(n => String(n).includes(q));
    return ms && mq;
  });
}

async function updateBuyer(id, { name, phone, paymentStatus, numbers }) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return false;

  const removed      = p.numbers.filter(n => !numbers.includes(n));
  const newNumStatus = paymentStatus === 'approved' ? 'paid'
                     : paymentStatus === 'rejected'  ? 'available' : 'pending';

  const updatedNumbers = { ...state.numbers };
  removed.forEach(n => { updatedNumbers[n] = { status: 'available' }; });
  numbers.forEach(n  => { updatedNumbers[n] = { status: newNumStatus }; });

  try {
    const batch = db.batch();
    batch.set(configDoc, { numbers: updatedNumbers }, { merge: true });
    batch.update(participantsCol.doc(id), { name, phone, paymentStatus, numbers });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Erro ao atualizar comprador:', err);
    toast('Erro ao salvar. Tente novamente.', 'error');
    return false;
  }
}

async function deleteBuyer(id) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return false;

  const updatedNumbers = { ...state.numbers };
  p.numbers.forEach(n => { updatedNumbers[n] = { status: 'available' }; });

  try {
    const batch = db.batch();
    batch.set(configDoc, { numbers: updatedNumbers }, { merge: true });
    batch.delete(participantsCol.doc(id));
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Erro ao remover comprador:', err);
    toast('Erro ao remover. Tente novamente.', 'error');
    return false;
  }
}

/* ──────────────────────────────────────────────────────────
   ADMIN — AUTENTICAÇÃO
────────────────────────────────────────────────────────── */
function openAdminLogin() {
  el('admin-password-input').value = '';
  openModal('modal-admin-login');
  setTimeout(() => el('admin-password-input').focus(), 100);
}
function closeAdminLogin() { closeModal('modal-admin-login'); }

function loginAdmin() {
  const input = el('admin-password-input').value;
  if (!state.config) {
    if (input !== 'Vidaloka2$%') {
      toast('Senha incorreta.', 'error'); return;
    }
    state.adminLoggedIn = true;
    closeAdminLogin();
    renderUI();
    openAdmin();
    toast('Bem-vindo! Configure a rifa na aba ⚙️ Config.', 'info');
    return;
  }
  if (input !== state.config.password) {
    toast('Senha incorreta.', 'error');
    el('admin-password-input').value = '';
    el('admin-password-input').focus();
    return;
  }
  state.adminLoggedIn = true;
  closeAdminLogin();
  renderUI();
  openAdmin();
}

function logoutAdmin() {
  state.adminLoggedIn = false;
  closeAdmin();
  renderUI();
  toast('Sessão encerrada.', 'info');
}

/* ──────────────────────────────────────────────────────────
   ADMIN — PAINEL
────────────────────────────────────────────────────────── */
function openAdmin() {
  if (!state.adminLoggedIn) { openAdminLogin(); return; }
  updateAdminStats();
  switchTab('requests');
  openModal('modal-admin');
}
function closeAdmin() { closeModal('modal-admin'); }

function switchTab(tab) {
  const tabs = ['requests', 'buyers', 'draw', 'settings'];
  tabs.forEach(t => {
    el(`admin-tab-${t}`).style.display = t === tab ? 'block' : 'none';
    el(`tab-btn-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'requests') renderRequests();
  if (tab === 'buyers')   renderBuyers();
  if (tab === 'draw')     { updateDrawInfoBar(); renderDrawHistory(); }
  if (tab === 'settings') loadSettingsForm();
}

function updateAdminStats() {
  if (!state.adminLoggedIn) return;
  const paid      = countByStatus('paid');
  const pending   = countByStatus('pending');
  const total     = state.config?.total || 0;
  const available = total - paid - pending;
  const earned    = paid * (state.config?.price || 0);
  const potential = total * (state.config?.price || 0);

  el('stat-earned').textContent       = fmtCurrency(earned);
  el('stat-paid').textContent         = paid;
  el('stat-pending').textContent      = pending;
  el('stat-available').textContent    = available;
  el('stat-participants').textContent = state.participants.length;
  el('stat-potential').textContent    = fmtCurrency(potential);

  const badge        = el('badge-requests');
  const pendingCount = state.participants.filter(p => p.paymentStatus === 'pending').length;
  badge.textContent   = pendingCount;
  badge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
}

/* ──────────────────────────────────────────────────────────
   ADMIN — SOLICITAÇÕES
────────────────────────────────────────────────────────── */
function renderRequests() {
  updateAdminStats();
  const statusLabels = { pending: '⏳ Aguardando', approved: '✅ Aprovado', rejected: '❌ Rejeitado' };
  const statusClass  = { pending: 'pending', approved: 'approved', rejected: 'rejected' };

  const pending   = state.participants.filter(p => p.paymentStatus === 'pending');
  const pendingEl = el('requests-pending-list');
  if (!pendingEl) return;

  pendingEl.innerHTML = pending.length === 0
    ? `<div class="empty-state"><span>🎉</span>Nenhuma solicitação pendente.</div>`
    : pending.map(p => requestCard(p, statusLabels, statusClass, true)).join('');

  const histFilter = el('requests-history-filter')?.value || 'all';
  const history    = state.participants.filter(p =>
    p.paymentStatus !== 'pending' &&
    (histFilter === 'all' || p.paymentStatus === histFilter)
  );
  const histEl = el('requests-history-list');
  if (!histEl) return;
  histEl.innerHTML = history.length === 0
    ? `<div class="empty-state"><span>📋</span>Sem histórico ainda.</div>`
    : history.map(p => requestCard(p, statusLabels, statusClass, false)).join('');
}

function requestCard(p, labels, cls, showActions) {
  const total = p.numbers.length * (state.config?.price || 0);
  return `
  <div class="request-card ${p.paymentStatus}">
    <div class="request-header">
      <div class="participant-left">
        <div class="participant-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="participant-name">${esc(p.name)}</div>
          <div class="participant-meta">📱 ${esc(p.phone)} · 📅 ${p.date} · ${fmtCurrency(total)}</div>
        </div>
      </div>
      <span class="payment-status ${cls[p.paymentStatus]}">${labels[p.paymentStatus] || p.paymentStatus}</span>
    </div>
    <div class="participant-numbers">
      ${p.numbers.map(n => `<span class="number-tag ${cls[p.paymentStatus]}">${pad(n)}</span>`).join('')}
    </div>
    ${showActions ? `
    <div class="request-actions">
      <button class="btn btn-approve" onclick="approveRequest('${p.id}')">✅ Aprovar Pagamento</button>
      <button class="btn btn-reject"  onclick="rejectRequest('${p.id}')">❌ Rejeitar</button>
    </div>` : `
    <div class="request-actions">
      <button class="btn btn-sm btn-outline-gray" onclick="openViewBuyer('${p.id}')">👁️ Ver</button>
      ${p.paymentStatus === 'rejected' ? `<button class="btn btn-sm btn-outline-gray" onclick="approveRequest('${p.id}')">↩ Aprovar</button>` : ''}
      <button class="btn btn-sm btn-danger" onclick="confirmDeleteBuyer('${p.id}')">🗑️</button>
    </div>`}
  </div>`;
}

async function approveRequest(id) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return;
  const ok = await updateBuyer(id, { name: p.name, phone: p.phone, paymentStatus: 'approved', numbers: p.numbers });
  if (ok) toast(`✅ Pagamento de ${p.name} aprovado!`, 'success');
}

async function rejectRequest(id) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return;
  if (!confirm(`Rejeitar solicitação de "${p.name}" e liberar os números?`)) return;
  const ok = await updateBuyer(id, { name: p.name, phone: p.phone, paymentStatus: 'rejected', numbers: p.numbers });
  if (ok) toast(`Solicitação de ${p.name} rejeitada. Números liberados.`, 'info');
}

/* ──────────────────────────────────────────────────────────
   ADMIN — COMPRADORES (CRUD)
────────────────────────────────────────────────────────── */
function renderBuyers() {
  const search    = el('admin-search')?.value || '';
  const status    = el('admin-filter-status')?.value || 'all';
  const list      = getBuyers({ search, status });
  const labels    = { pending: '⏳ Aguardando', approved: '✅ Aprovado', rejected: '❌ Rejeitado' };
  const cls       = { pending: 'pending', approved: 'approved', rejected: 'rejected' };
  const container = el('admin-buyers-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><span>👥</span>${search || status !== 'all' ? 'Nenhum resultado.' : 'Nenhum participante ainda.'}</div>`;
    return;
  }
  container.innerHTML = list.map(p => {
    const total = p.numbers.length * (state.config?.price || 0);
    return `
    <div class="participant-card">
      <div class="participant-header">
        <div class="participant-left">
          <div class="participant-avatar">${p.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="participant-name">${esc(p.name)}</div>
            <div class="participant-meta">📱 ${esc(p.phone)} · 📅 ${p.date} · ${fmtCurrency(total)}</div>
          </div>
        </div>
        <span class="payment-status ${cls[p.paymentStatus]}">${labels[p.paymentStatus] || p.paymentStatus}</span>
      </div>
      <div class="participant-numbers">
        ${p.numbers.map(n => `<span class="number-tag ${cls[p.paymentStatus]}">${pad(n)}</span>`).join('')}
      </div>
      <div class="payment-actions">
        <button class="btn btn-sm btn-outline-gray" onclick="openViewBuyer('${p.id}')">👁️ Ver</button>
        <button class="btn btn-sm btn-primary" onclick="openEditBuyer('${p.id}')">✏️ Editar</button>
        ${p.paymentStatus === 'pending' ? `<button class="btn btn-sm btn-approve" onclick="approveRequest('${p.id}')">✅ Aprovar</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteBuyer('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function openViewBuyer(id) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return;
  const total  = p.numbers.length * (state.config?.price || 0);
  const labels = { pending: '⏳ Aguardando', approved: '✅ Aprovado', rejected: '❌ Rejeitado' };
  const cls    = { pending: 'pending', approved: 'approved', rejected: 'rejected' };

  el('view-buyer-body').innerHTML = `
    <div class="view-buyer-info">
      <div class="participant-avatar large">${p.name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="view-buyer-name">${esc(p.name)}</div>
        <div class="participant-meta">📱 ${esc(p.phone)}</div>
        <div class="participant-meta">📅 ${p.date}</div>
      </div>
    </div>
    <div class="view-buyer-row"><span>Status</span>
      <span class="payment-status ${cls[p.paymentStatus]}">${labels[p.paymentStatus] || p.paymentStatus}</span></div>
    <div class="view-buyer-row"><span>Números (${p.numbers.length})</span>
      <div class="participant-numbers" style="justify-content:flex-end">
        ${p.numbers.map(n => `<span class="number-tag ${cls[p.paymentStatus]}">${pad(n)}</span>`).join('')}
      </div></div>
    <div class="view-buyer-row view-buyer-total"><span>Total</span><strong>${fmtCurrency(total)}</strong></div>`;

  el('view-buyer-footer').innerHTML = `
    <button class="btn btn-outline-gray" onclick="closeViewBuyer()">Fechar</button>
    <button class="btn btn-primary" onclick="closeViewBuyer();openEditBuyer('${p.id}')">✏️ Editar</button>`;
  openModal('modal-view-buyer');
}
function closeViewBuyer() { closeModal('modal-view-buyer'); }

function openEditBuyer(id) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return;
  state.editingNums = [...p.numbers];
  el('edit-buyer-id').value     = id;
  el('edit-buyer-name').value   = p.name;
  el('edit-buyer-phone').value  = p.phone;
  el('edit-buyer-status').value = p.paymentStatus;
  renderEditNumbers();
  openModal('modal-edit-buyer');
}
function closeEditBuyer() { closeModal('modal-edit-buyer'); }

function renderEditNumbers() {
  const status = el('edit-buyer-status')?.value || 'pending';
  const cls    = { pending: 'pending', approved: 'approved', rejected: 'rejected' };
  const tagCls = cls[status] || 'pending';

  el('edit-buyer-numbers-tags').innerHTML = state.editingNums.length === 0
    ? '<span class="empty-tags">Nenhum número</span>'
    : state.editingNums.sort((a, b) => a - b).map(n =>
        `<span class="number-tag ${tagCls}" style="cursor:pointer" title="Remover" onclick="removeEditNumber(${n})">${pad(n)} ✕</span>`
      ).join('');

  const total = state.editingNums.length * (state.config?.price || 0);
  el('edit-summary').innerHTML =
    `<span>${state.editingNums.length} número${state.editingNums.length !== 1 ? 's' : ''}</span>
     <span class="edit-summary-total">${fmtCurrency(total)}</span>`;
}

function addEditNumber() {
  const input   = el('edit-add-num-input');
  const buyerId = el('edit-buyer-id').value;
  const num     = parseInt(input.value);
  if (!num || num < 1 || num > (state.config?.total || 0)) {
    toast(`Número inválido (1–${state.config?.total}).`, 'error'); return;
  }
  if (state.editingNums.includes(num)) {
    toast(`Número ${pad(num)} já na lista.`, 'warning'); return;
  }
  const numStatus = state.numbers[num]?.status || 'available';
  const owner     = state.participants.find(p => p.id !== buyerId && p.numbers.includes(num));
  if (numStatus !== 'available' && owner) {
    toast(`Número ${pad(num)} pertence a ${owner.name}.`, 'error'); return;
  }
  state.editingNums.push(num);
  input.value = '';
  renderEditNumbers();
}

function removeEditNumber(num) {
  state.editingNums = state.editingNums.filter(n => n !== num);
  renderEditNumbers();
}

async function saveEditBuyer() {
  const id     = el('edit-buyer-id').value;
  const name   = el('edit-buyer-name').value.trim();
  const phone  = el('edit-buyer-phone').value.trim();
  const status = el('edit-buyer-status').value;
  if (!name)  return toast('Informe o nome.', 'error');
  if (!phone) return toast('Informe o WhatsApp.', 'error');
  if (phone.replace(/\D/g, '').length < 10) return toast('WhatsApp inválido.', 'error');
  if (state.editingNums.length === 0) return toast('Adicione ao menos um número.', 'error');

  const ok = await updateBuyer(id, { name, phone, paymentStatus: status, numbers: [...state.editingNums] });
  if (ok) {
    closeEditBuyer();
    toast('Comprador atualizado!', 'success');
  }
}

async function confirmDeleteBuyer(id) {
  const p = state.participants.find(p => p.id === id);
  if (!p) return;
  if (!confirm(`Remover "${p.name}" e liberar os números?`)) return;
  const ok = await deleteBuyer(id);
  if (ok) toast('Comprador removido.', 'info');
}

/* ──────────────────────────────────────────────────────────
   ADMIN — CONFIGURAÇÕES
────────────────────────────────────────────────────────── */
function loadSettingsForm() {
  const c = state.config;
  el('cfg-admin-whatsapp').value   = c?.adminWhatsapp   || '';
  el('cfg-name').value             = c?.name            || '';
  el('cfg-total').value            = c?.total           || '';
  el('cfg-price').value            = c?.price           || '';
  el('cfg-description').value      = c?.description     || '';
  el('cfg-pix-type').value         = c?.pixKeyType      || 'email';
  el('cfg-pix-key').value          = c?.pixKey          || '';
  el('cfg-pix-holder').value       = c?.pixHolder       || '';
  el('cfg-pix-bank').value         = c?.pixBank         || '';
  el('cfg-pix-instructions').value = c?.pixInstructions || '';
  el('cfg-password').value         = '';
  el('cfg-numbers-warning').style.display = c ? 'block' : 'none';
}

async function saveSettings() {
  const adminWa   = el('cfg-admin-whatsapp').value.trim();
  const name      = el('cfg-name').value.trim();
  const total     = parseInt(el('cfg-total').value);
  const price     = parseFloat(el('cfg-price').value);
  const desc      = el('cfg-description').value.trim();
  const pixType   = el('cfg-pix-type').value;
  const pixKey    = el('cfg-pix-key').value.trim();
  const pixHolder = el('cfg-pix-holder').value.trim();
  const pixBank   = el('cfg-pix-bank').value.trim();
  const pixInstr  = el('cfg-pix-instructions').value.trim();
  const newPass   = el('cfg-password').value;

  if (!adminWa)             return toast('Informe o WhatsApp do administrador.', 'error');
  if (adminWa.replace(/\D/g,'').length < 10) return toast('WhatsApp do admin inválido.', 'error');
  if (!name)                return toast('Informe o nome da rifa.', 'error');
  if (!total || total < 1)  return toast('Quantidade mínima: 1.', 'error');
  if (total > 1000)         return toast('Máximo: 1000 números.', 'error');
  if (!price || price <= 0) return toast('Informe o valor por número.', 'error');
  if (!pixKey)              return toast('Informe a chave PIX.', 'error');
  if (!pixHolder)           return toast('Informe o nome do titular.', 'error');

  const password  = newPass || state.config?.password || 'Vidaloka2$%';
  const prevTotal = state.config?.total;
  const newConfig = { adminWhatsapp: adminWa, name, total, price, description: desc, password, pixKeyType: pixType, pixKey, pixHolder, pixBank, pixInstructions: pixInstr };

  if (!prevTotal || prevTotal !== total) buildNumbers(total);

  try {
    await configDoc.set({ config: newConfig, numbers: state.numbers });
    state.config = newConfig;
    renderUI();
    updateAdminStats();
    toast('Configurações salvas!', 'success');
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
    toast('Erro ao salvar. Verifique as regras do Firestore.', 'error');
  }
}

function buildNumbers(total) {
  const prev = { ...state.numbers };
  state.numbers = {};
  for (let i = 1; i <= total; i++) {
    state.numbers[i] = prev[i] || { status: 'available' };
  }
}

async function resetRaffle() {
  if (!confirm('⚠️ Isso apagará TODOS os dados. Confirmar?')) return;
  try {
    await configDoc.delete();

    const partsSnap = await participantsCol.get();
    if (!partsSnap.empty) {
      const b = db.batch();
      partsSnap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
    }

    const histSnap = await drawHistoryCol.get();
    if (!histSnap.empty) {
      const b = db.batch();
      histSnap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
    }

    state = { config: null, numbers: {}, participants: [], drawHistory: [], selected: [], adminLoggedIn: true, editingNums: [], _adminClickCount: 0, _adminClickTimer: null, _pendingBuyer: null };
    closeAdmin();
    renderUI();
    toast('Rifa resetada.', 'info');
    openAdmin();
  } catch (err) {
    console.error('Erro ao resetar:', err);
    toast('Erro ao resetar. Tente novamente.', 'error');
  }
}

/* ──────────────────────────────────────────────────────────
   ADMIN — SORTEIO
────────────────────────────────────────────────────────── */
function getPaidNumbers() {
  return state.participants
    .filter(p => p.paymentStatus === 'approved')
    .flatMap(p => p.numbers.map(n => ({ number: n, name: p.name, phone: p.phone })));
}

function updateDrawInfoBar() {
  const count = getPaidNumbers().length;
  el('draw-info-bar').textContent =
    `${count} número${count !== 1 ? 's' : ''} vendido${count !== 1 ? 's' : ''} disponível${count !== 1 ? 'is' : ''} para sorteio`;
}

function drawWinner() {
  const prize = el('draw-prize')?.value.trim();
  const date  = el('draw-date')?.value;
  if (!prize) { toast('Informe o nome do prêmio.', 'error'); return; }

  const eligible = getPaidNumbers();
  if (eligible.length === 0) { toast('Nenhum número vendido para sortear.', 'error'); return; }

  const alreadyWon = state.drawHistory.filter(h => h.prize === prize).map(h => h.number);
  const pool       = eligible.filter(p => !alreadyWon.includes(p.number));
  if (pool.length === 0) { toast('Todos os números já foram sorteados para este prêmio.', 'warning'); return; }

  openModal('modal-draw-result');
  animateDraw(pool, prize, date);
}

function animateDraw(pool, prize, date) {
  const icon  = el('draw-anim-icon');
  const numEl = el('draw-winner-number');
  icon.textContent = '🎰';
  el('draw-result-title').textContent = 'Sorteando…';
  numEl.innerHTML = '';
  el('draw-winner-info').innerHTML = '';
  el('draw-result-prize').textContent = '';
  el('draw-result-date').textContent  = '';
  icon.classList.add('spinning');

  let ticks = 0, max = 24 + Math.floor(Math.random() * 10);
  const interval = setInterval(() => {
    const fake = pool[Math.floor(Math.random() * pool.length)];
    numEl.textContent = pad(fake.number);
    if (++ticks >= max) {
      clearInterval(interval);
      icon.classList.remove('spinning');
      revealWinner(pool, prize, date);
    }
  }, 80);
}

async function revealWinner(pool, prize, date) {
  const winner = pool[Math.floor(Math.random() * pool.length)];
  el('draw-anim-icon').textContent = '🏆';
  el('draw-anim-icon').classList.add('pop-in');
  el('draw-result-title').textContent = 'Temos um vencedor!';
  el('draw-winner-number').innerHTML  =
    `<span class="winner-number-badge">${pad(winner.number)}</span>`;
  el('draw-winner-info').innerHTML    =
    `<div class="winner-name">${esc(winner.name)}</div>
     <div class="winner-phone">📱 ${esc(winner.phone)}</div>`;
  el('draw-result-prize').textContent = `🎁 ${prize}`;
  el('draw-result-date').textContent  =
    date ? `📅 ${fmtDate(date)}` : `📅 ${new Date().toLocaleDateString('pt-BR')}`;

  try {
    await drawHistoryCol.add({
      number:    winner.number,
      name:      winner.name,
      phone:     winner.phone,
      prize,
      date:      date || null,
      timestamp: new Date().toLocaleString('pt-BR'),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao salvar sorteio:', err);
    toast('Resultado não salvo no banco. Anote o ganhador!', 'error');
  }
}

function closeDrawResult() {
  closeModal('modal-draw-result');
  el('draw-anim-icon').classList.remove('spinning', 'pop-in');
}

function renderDrawHistory() {
  const list     = el('draw-history-list');
  const btnClear = el('btn-clear-draw');
  if (!list) return;

  if (state.drawHistory.length === 0) {
    list.innerHTML = `<div class="empty-state"><span>🏆</span>Nenhum sorteio realizado.</div>`;
    if (btnClear) btnClear.style.display = 'none';
    return;
  }
  if (btnClear) btnClear.style.display = 'inline-flex';
  list.innerHTML = state.drawHistory.map(h => `
    <div class="draw-history-card">
      <div class="draw-history-number">${pad(h.number)}</div>
      <div class="draw-history-info">
        <div class="draw-history-name">${esc(h.name)}</div>
        <div class="draw-history-meta">📱 ${esc(h.phone)} · 🎁 ${esc(h.prize)}</div>
        <div class="draw-history-date">📅 ${h.timestamp}</div>
      </div>
      <button class="btn-close" onclick="removeDrawEntry('${h.id}')">✕</button>
    </div>`).join('');
}

async function removeDrawEntry(id) {
  try {
    await drawHistoryCol.doc(id).delete();
  } catch (err) {
    console.error('Erro ao remover:', err);
    toast('Erro ao remover entrada.', 'error');
  }
}

async function clearDrawHistory() {
  if (!confirm('Apagar todo o histórico de sorteios?')) return;
  try {
    const snap = await drawHistoryCol.get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    toast('Histórico limpo.', 'info');
  } catch (err) {
    console.error('Erro ao limpar histórico:', err);
    toast('Erro ao limpar. Tente novamente.', 'error');
  }
}

/* ──────────────────────────────────────────────────────────
   UTILITÁRIOS DE MODAL
────────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
});

/* ──────────────────────────────────────────────────────────
   UTILITÁRIOS GERAIS
────────────────────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function pad(n) { return String(n).padStart(2, '0'); }

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtDate(iso) {
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`;
}
function maskPhone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6)      v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
  else if (v.length > 0) v = `(${v}`;
  input.value = v;
}
function toggleEye(id, btn) {
  const inp = el(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ──────────────────────────────────────────────────────────
   TOASTS
────────────────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  el('toast-container').appendChild(div);
  setTimeout(() => {
    div.classList.add('toast-out');
    div.addEventListener('animationend', () => div.remove());
  }, 3500);
}

/* ──────────────────────────────────────────────────────────
   WHATSAPP
────────────────────────────────────────────────────────── */
function toWaPhone(phone) {
  const d = phone.replace(/\D/g, '');
  if (d.length <= 11) return '55' + d;
  return d;
}

function buildAdminNotificationUrl(buyer, adminPhone) {
  const total = buyer.numbers.length * (state.config?.price || 0);
  const nums  = buyer.numbers.map(pad).join(', ');
  const msg =
`🎟️ *Nova reserva na rifa!*

👤 *Comprador:* ${buyer.name}
📱 *WhatsApp:* ${buyer.phone}
🔢 *Números:* ${nums}
💰 *Total:* ${fmtCurrency(total)}

⏳ Aguardando confirmação do pagamento.`;
  return `https://api.whatsapp.com/send?phone=${toWaPhone(adminPhone)}&text=${encodeURIComponent(msg)}`;
}

function buildBuyerProofUrl(buyer, adminPhone) {
  const total = buyer.numbers.length * (state.config?.price || 0);
  const nums  = buyer.numbers.map(pad).join(', ');
  const raffName = state.config?.name || 'Rifa';
  const msg =
`Olá! Realizei meu pagamento na *${raffName}*.

👤 *Nome:* ${buyer.name}
📱 *Meu WhatsApp:* ${buyer.phone}
🔢 *Números:* ${nums}
💰 *Total:* ${fmtCurrency(total)}

Segue o comprovante de pagamento! ✅`;
  return `https://api.whatsapp.com/send?phone=${toWaPhone(adminPhone)}&text=${encodeURIComponent(msg)}`;
}

/* ──────────────────────────────────────────────────────────
   TEMA (dark / light)
────────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('rifa_theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('rifa_theme', theme);
  const btn = el('btn-theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ──────────────────────────────────────────────────────────
   BOOT
────────────────────────────────────────────────────────── */
initTheme();
init();
