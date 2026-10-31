// Kiểm bảng "Mô hình Eval-Gated 2029": số trên khối, dot theo sự kiện live, khối giữ màu khi xử lý, không tràn ngang ở 390px.
// Chạy: D3=/đường/dẫn/d3.min.js OUT=/thư/mục/ảnh node tests/model.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || '/tmp/t020', D3 = process.env.D3;
if (!D3) { console.error('Cần D3=/đường/dẫn/d3.min.js'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const base = { id: 'T-001', title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-10-31T09:00', hours_since_update: 2, tier: 'A', area: 'front/budget', evals: 2, spec_returns: 0, evals_added: 0 };
const tasks = [
  { ...base, id: 'T-001' }, { ...base, id: 'T-002', owner: 'product', holder: 'spec-critic', reviewer: 'spec-critic', state: 'review' },
  { ...base, id: 'T-003', state: 'spec', holder: 'product', spec_returns: 1 }, { ...base, id: 'T-004', state: 'rework', rounds: 1 },
  { ...base, id: 'T-005', state: 'escalated', holder: 'capu' }, { ...base, id: 'T-006', state: 'done', holder: '-', tier: 'B', hours_since_update: 5 },
];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const data = { generated_at: '2026-10-31T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'front/budget': 2 }, invariants_total: 2, adversarial_evals: 1, regression_evals: 0, insight_reports: 1, last_insight: '2026-10-25-weekly.md', specs: 2 } };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch();
  for (const [name, vp] of [['desktop', { width: 1200, height: 1500 }], ['phone', { width: 390, height: 900 }]]) {
    const page = await browser.newPage({ viewport: vp });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    let sock; await page.routeWebSocket(/\/ws$/, ws => { sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await page.waitForTimeout(1500);
    const txt = async sel => page.$eval(sel, e => e.textContent);
    ok((await txt('#nd_exec .n')) === '1', name + ': Agent code đếm 1 đang code');
    ok((await txt('#sgateQ')).startsWith('1'), name + ': Spec Gate 1 chờ');
    ok((await txt('#nd_respec .n')) === '1', name + ': Spec rework 1');
    ok((await txt('#nd_rework .n')) === '1', name + ': Code rework 1');
    ok((await txt('#nd_capu .n')) === '2', name + ': Capu = 1 leo thang + 1 diff hành vi');
    ok((await txt('#krTxt')).includes('2 bất biến'), name + ': bể đếm bất biến');
    const send = o => sock.send(JSON.stringify({ type: 'event', t: '2026-10-31T10:05', received: Date.now(), ...o }));
    send({ id: 'E-1', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-001', state: 'review', holder: 'adversary' });
    await page.waitForTimeout(300);
    ok((await page.$$eval('#fx_f circle', c => c.length)) >= 1, name + ': dot chạy sau sự kiện live');
    await page.waitForTimeout(1800);
    ok(await page.$eval('#gt_code', e => e.classList.contains('busy')), name + ': Code Gate lên màu khi dot chạm');
    send({ id: 'E-2', event: 'rejected', from: 'adversary', to: 'product', task: 'T-001', state: 'spec', holder: 'product', severity: 'blocker' });
    await page.waitForTimeout(400);
    ok(!(await page.$eval('#gt_code', e => e.classList.contains('busy'))), name + ': Code Gate tắt màu khi dot đi ra');
    await page.waitForTimeout(1800);
    ok(await page.$eval('#nd_respec', e => e.classList.contains('busy')), name + ': Spec rework lên màu');
    ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), name + ': không tràn ngang');
    ok(errors.length === 0, name + ': không lỗi console (' + errors.join('; ') + ')');
    await (await page.$('#model')).screenshot({ path: path.join(OUT, `model-${name}.png`) });
    await page.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAIL` : 'Tất cả PASS'); process.exit(fails ? 1 : 0);
})();
