const KEY = 'rafiq_mansion_data';
const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DEFAULT_FLATS = ['Flat 101','Flat 102','Flat 103','Flat 104','Flat 201','Flat 202','Flat 203','Flat 204',
  'Flat 301','Flat 302','Flat 303','Flat 304','Flat 401','Flat 402','Flat 403','Flat 404','Shop 01','Shop 02'];

let appData = {
  openingBalance: 0, monthlyCharge: 0, flats: [...DEFAULT_FLATS],
  categories: ['K-Electric','Janitor / Sweeper','Water Tanker','Plumbing Work','General Maintenance'],
  incomes: [], expenses: []
};
let year = new Date().getFullYear();
let monthFilter = 'all';
const $ = id => document.getElementById(id);
const rs = n => 'Rs. ' + Number(n || 0).toLocaleString();
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum = a => a.reduce((t, x) => t + x.amount, 0);

/* ---------- storage ---------- */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) appData = { ...appData, ...s };
  } catch (e) { console.error('Bad saved data', e); }
  if (!appData.flats.length) appData.flats = [...DEFAULT_FLATS];
  // migrate: older entries had no year
  appData.incomes.forEach(i => { if (!i.year) i.year = parseInt(i.date) || year; });
}
function save() { localStorage.setItem(KEY, JSON.stringify(appData)); renderAll(); }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- data for selected year ---------- */
const yInc = () => appData.incomes.filter(i => i.year === year);
const yExp = () => appData.expenses.filter(e => parseInt(e.date) === year);
const expMonth = e => parseInt(e.date.slice(5, 7)) - 1;

function monthStats() {
  const inc = Array(12).fill(0), exp = Array(12).fill(0);
  yInc().forEach(i => inc[M.indexOf(i.month)] += i.amount);
  yExp().forEach(e => exp[expMonth(e)] += e.amount);
  let bal = appData.openingBalance;
  return M.map((_, k) => {
    const open = bal; bal = open + inc[k] - exp[k];
    return { open, inc: inc[k], exp: exp[k], close: bal };
  });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  load();
  const today = new Date().toISOString().split('T')[0];
  $('inc-date').value = $('exp-date').value = today;
  $('inc-month').innerHTML = M.map((m, k) => `<option value="${m}">${MF[k]}</option>`).join('');
  $('inc-month').value = M[new Date().getMonth()];
  $('sel-month').innerHTML = '<option value="all">All months</option>' + M.map((m, k) => `<option value="${k}">${MF[k]}</option>`).join('');

  $('nav').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + b.dataset.view));
    $('title').textContent = b.querySelector('span').textContent;
    window.scrollTo(0, 0);
  });
  $('sel-year').addEventListener('change', e => { year = +e.target.value; renderAll(); });
  $('sel-month').addEventListener('change', e => { monthFilter = e.target.value; renderTables(); });
  $('f-inc').addEventListener('submit', addIncome);
  $('f-exp').addEventListener('submit', addExpense);
  $('b-save-set').addEventListener('click', saveSettings);
  $('b-flat').addEventListener('click', () => addItem('flats', 'inp-flat'));
  $('b-cat').addEventListener('click', () => addItem('categories', 'inp-cat'));
  $('b-wa').addEventListener('click', shareSummary);
  $('b-xl').addEventListener('click', exportExcel);
  $('b-pdf').addEventListener('click', exportPDF);
  $('b-backup').addEventListener('click', backup);
  $('f-restore').addEventListener('change', restore);

  // delegated clicks for delete / receipt / tag removal
  document.body.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const { act, id } = b.dataset;
    if (act === 'rcpt') shareReceipt(+id);
    if (act === 'delinc' && confirm('Delete this collection entry?')) { appData.incomes = appData.incomes.filter(i => i.id !== +id); save(); }
    if (act === 'delexp' && confirm('Delete this expense entry?')) { appData.expenses = appData.expenses.filter(x => x.id !== +id); save(); }
    if (act === 'rmflat' && confirm(`Remove "${appData.flats[id]}"?`)) { appData.flats.splice(+id, 1); save(); }
    if (act === 'rmcat' && confirm(`Remove "${appData.categories[id]}"?`)) { appData.categories.splice(+id, 1); save(); }
  });
  renderAll();
});

/* ---------- actions ---------- */
function addIncome(e) {
  e.preventDefault();
  const flat = $('inc-flat').value; if (!flat) return toast('Add a flat in Settings first');
  const date = $('inc-date').value;
  appData.incomes.unshift({ id: Date.now(), flat, month: $('inc-month').value, amount: parseFloat($('inc-amount').value) || 0, date, year: parseInt(date) });
  $('inc-amount').value = ''; save(); toast('Collection added');
}
function addExpense(e) {
  e.preventDefault();
  appData.expenses.unshift({ id: Date.now(), category: $('exp-cat').value, amount: parseFloat($('exp-amount').value) || 0, date: $('exp-date').value, desc: $('exp-desc').value.trim() });
  $('exp-amount').value = $('exp-desc').value = ''; save(); toast('Expense added');
}
function addItem(list, inputId) {
  const v = $(inputId).value.trim();
  if (v && !appData[list].includes(v)) { appData[list].push(v); $(inputId).value = ''; save(); }
}
function saveSettings() {
  appData.openingBalance = parseFloat($('inp-open').value) || 0;
  appData.monthlyCharge = parseFloat($('inp-charge').value) || 0;
  save(); toast('Settings saved');
}
function backup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(appData)], { type: 'application/json' }));
  a.download = `rafiq_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
}
function restore(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.incomes) || !Array.isArray(d.expenses)) throw 0;
      if (!confirm('This replaces all current data. Continue?')) return;
      appData = { ...appData, ...d }; load(); save(); toast('Backup restored');
    } catch { alert('This file is not a valid Rafiq backup.'); }
  };
  r.readAsText(f); e.target.value = '';
}

/* ---------- rendering ---------- */
function renderAll() {
  const years = new Set([new Date().getFullYear(), year]);
  appData.incomes.forEach(i => years.add(i.year));
  appData.expenses.forEach(e => years.add(parseInt(e.date)));
  $('sel-year').innerHTML = [...years].sort().map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('');

  $('inc-flat').innerHTML = appData.flats.length ? appData.flats.map(f => `<option>${esc(f)}</option>`).join('') : '<option value="">No flats yet</option>';
  $('exp-cat').innerHTML = appData.categories.map(c => `<option>${esc(c)}</option>`).join('');
  $('inp-open').value = appData.openingBalance || '';
  $('inp-charge').value = appData.monthlyCharge || '';
  $('flat-tags').innerHTML = appData.flats.map((f, k) => `<span class="tag">${esc(f)}<button data-act="rmflat" data-id="${k}" aria-label="Remove ${esc(f)}"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
  $('cat-tags').innerHTML = appData.categories.map((c, k) => `<span class="tag">${esc(c)}<button data-act="rmcat" data-id="${k}" aria-label="Remove ${esc(c)}"><i class="fa-solid fa-xmark"></i></button></span>`).join('');

  const tin = sum(yInc()), tout = sum(yExp());
  $('k-open').textContent = rs(appData.openingBalance);
  $('k-in').textContent = rs(tin);
  $('k-out').textContent = rs(tout);
  $('k-net').textContent = rs(appData.openingBalance + tin - tout);
  renderChart(); renderCats(); renderMonthly(); renderTables();
}

function renderChart() {
  const st = monthStats(), max = Math.max(1, ...st.map(s => Math.max(s.inc, s.exp)));
  $('chart').innerHTML = st.map((s, k) => `<div class="col" title="${MF[k]}: collected ${rs(s.inc)}, spent ${rs(s.exp)}">
    <div class="bars"><i class="a" style="height:${s.inc / max * 100}%"></i><i class="b" style="height:${s.exp / max * 100}%"></i></div><small>${M[k]}</small></div>`).join('');
}

function renderCats() {
  const by = {}; yExp().forEach(e => by[e.category] = (by[e.category] || 0) + e.amount);
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]), total = sum(yExp()) || 1;
  $('catbars').innerHTML = rows.length ? rows.map(([c, v]) =>
    `<div class="cb"><div><span>${esc(c)}</span><em>${rs(v)} · ${Math.round(v / total * 100)}%</em></div><u style="width:${v / total * 100}%"></u></div>`).join('')
    : '<p class="empty">No expenses recorded for ' + year + '</p>';
}

function renderMonthly() {
  const st = monthStats();
  const tin = st.reduce((t, s) => t + s.inc, 0), tout = st.reduce((t, s) => t + s.exp, 0);
  $('t-month').innerHTML = `<thead><tr><th>Month</th><th class="r">Opening</th><th class="r">Collected</th><th class="r">Spent</th><th class="r">Month result</th><th class="r">Closing</th></tr></thead><tbody>` +
    st.map((s, k) => `<tr><td><strong>${MF[k]}</strong></td><td class="r">${rs(s.open)}</td><td class="r pos">${rs(s.inc)}</td><td class="r neg">${rs(s.exp)}</td>
      <td class="r ${s.inc - s.exp >= 0 ? 'pos' : 'neg'}">${s.inc - s.exp >= 0 ? '+' : '−'}${rs(Math.abs(s.inc - s.exp))}</td><td class="r"><strong>${rs(s.close)}</strong></td></tr>`).join('') +
    `</tbody><tfoot><tr><td>Year total</td><td class="r">${rs(appData.openingBalance)}</td><td class="r pos">${rs(tin)}</td><td class="r neg">${rs(tout)}</td><td class="r">${rs(tin - tout)}</td><td class="r">${rs(st[11].close)}</td></tr></tfoot>`;

  const paid = {}; yInc().forEach(i => { const k = i.flat + '|' + i.month; paid[k] = (paid[k] || 0) + i.amount; });
  const ch = appData.monthlyCharge, colTot = Array(12).fill(0);
  let rowsH = appData.flats.map(f => {
    let t = 0;
    const cells = M.map((m, k) => {
      const v = paid[f + '|' + m] || 0; t += v; colTot[k] += v;
      const cls = v === 0 ? 'c-due' : (ch && v < ch ? 'c-part' : 'c-paid');
      return `<td class="${cls}">${v ? v.toLocaleString() : '—'}</td>`;
    }).join('');
    const due = ch ? Math.max(0, ch * 12 - t) : null;
    return `<tr><td>${esc(f)}</td>${cells}<td><strong>${t.toLocaleString()}</strong></td><td class="${due ? 'neg' : ''}">${due === null ? '' : due.toLocaleString()}</td></tr>`;
  }).join('');
  $('t-matrix').innerHTML = `<thead><tr><th>Flat</th>${M.map(m => `<th>${m}</th>`).join('')}<th>Paid</th><th>${ch ? 'Due' : ''}</th></tr></thead><tbody>${rowsH}</tbody>
    <tfoot><tr><td>Total</td>${colTot.map(v => `<td>${v.toLocaleString()}</td>`).join('')}<td>${colTot.reduce((a, b) => a + b, 0).toLocaleString()}</td><td></td></tr></tfoot>`;
}

function renderTables() {
  const inc = yInc().filter(i => monthFilter === 'all' || M.indexOf(i.month) === +monthFilter);
  const exp = yExp().filter(e => monthFilter === 'all' || expMonth(e) === +monthFilter);
  $('s-inc').textContent = rs(sum(inc)); $('s-exp').textContent = rs(sum(exp));
  $('b-inc').innerHTML = inc.length ? inc.map(i => `<tr><td>${i.date}</td><td><strong>${esc(i.flat)}</strong></td><td>${i.month}</td><td class="r pos">${rs(i.amount)}</td>
    <td><button class="ic wa-i" data-act="rcpt" data-id="${i.id}" title="Send receipt" aria-label="Send receipt"><i class="fa-brands fa-whatsapp"></i></button><button class="ic" data-act="delinc" data-id="${i.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">No collections for this period</td></tr>';
  $('b-exp').innerHTML = exp.length ? exp.map(e => `<tr><td>${e.date}</td><td><span class="chip">${esc(e.category)}</span></td><td>${esc(e.desc)}</td><td class="r neg">${rs(e.amount)}</td>
    <td><button class="ic" data-act="delexp" data-id="${e.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">No expenses for this period</td></tr>';
}

/* ---------- share & export ---------- */
function shareReceipt(id) {
  const i = appData.incomes.find(x => x.id === id); if (!i) return;
  const msg = `*RAFIQ MANSION MAINTENANCE RECEIPT*\n------------------------------------\n*Flat:* ${i.flat}\n*For Month:* ${i.month} ${i.year}\n*Amount Paid:* ${rs(i.amount)}\n*Date:* ${i.date}\n------------------------------------\nThank you for your prompt payment!`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}
function shareSummary() {
  const st = monthStats(), tin = sum(yInc()), tout = sum(yExp());
  const lines = st.map((s, k) => (s.inc || s.exp) ? `${M[k]}: +${s.inc.toLocaleString()} / −${s.exp.toLocaleString()}` : null).filter(Boolean).join('\n');
  const msg = `*RAFIQ MANSION SUMMARY ${year}*\n------------------------------------\n*Opening:* ${rs(appData.openingBalance)}\n*Collected:* ${rs(tin)}\n*Spent:* ${rs(tout)}\n*Cash in hand:* ${rs(appData.openingBalance + tin - tout)}\n------------------------------------\n${lines}`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}
function exportExcel() {
  if (typeof XLSX === 'undefined') return alert('Excel library failed to load. Check your internet connection.');
  const wb = XLSX.utils.book_new();
  const st = monthStats().map((s, k) => ({ Month: MF[k], Opening: s.open, Collected: s.inc, Spent: s.exp, Closing: s.close }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st), 'Monthly Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yInc().map(i => ({ Date: i.date, Flat: i.flat, Month: i.month, 'Amount (Rs)': i.amount }))), 'Collections');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yExp().map(e => ({ Date: e.date, Category: e.category, Particulars: e.desc, 'Amount (Rs)': e.amount }))), 'Expenses');
  XLSX.writeFile(wb, `Rafiq_Mansion_Ledger_${year}.xlsx`);
}
function exportPDF() {
  if (!window.jspdf) return alert('PDF library failed to load. Check your internet connection.');
  const doc = new window.jspdf.jsPDF();
  doc.setFontSize(16); doc.text('Rafiq Mansion Maintenance Committee', 14, 18);
  doc.setFontSize(10); doc.text(`Financial report ${year}`, 14, 24);
  doc.autoTable({ startY: 30, headStyles: { fillColor: [14, 42, 47] },
    head: [['Month', 'Opening', 'Collected', 'Spent', 'Closing']],
    body: monthStats().map((s, k) => [MF[k], s.open, s.inc, s.exp, s.close]) });
  doc.text('Collections', 14, doc.lastAutoTable.finalY + 10);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 13, headStyles: { fillColor: [15, 123, 95] },
    head: [['Date', 'Flat', 'Month', 'Amount']], body: yInc().map(i => [i.date, i.flat, i.month, i.amount]) });
  doc.text('Expenses', 14, doc.lastAutoTable.finalY + 10);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 13, headStyles: { fillColor: [194, 65, 12] },
    head: [['Date', 'Category', 'Details', 'Amount']], body: yExp().map(e => [e.date, e.category, e.desc, e.amount]) });
  doc.save(`Rafiq_Mansion_Report_${year}.pdf`);
}
