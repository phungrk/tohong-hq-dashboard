// Kiểm bộ lọc sản phẩm (T-042, spec T-041): bộ chọn, lọc bảng/KPI, nhãn "cả công ty" ở Đội ngũ, cây bất biến ở khối bể, nhớ lựa chọn, 390px.
// Chạy: D3=/đường/dẫn/d3.min.js node tests/product-filter.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D3 = process.env.D3;
if (!D3) { console.error('Cần D3=/đường/dẫn/d3.min.js'); process.exit(2); }
const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: new Date(Date.now() + 7 * 3600e3 - 3600e3).toISOString().slice(0, 16), hours_since_update: 1, tier: 'A', evals: 1, spec_returns: 0, evals_added: 0 };
const tasks = [{ ...base, id: 'T-1', area: 'planner/front', product: 'planner' }, { ...base, id: 'T-2', area: 'dashboard/model', product: 'hq' }, { ...base, id: 'T-3', area: 'hq/dashboard', product: 'hq', state: 'blocked' }, { ...base, id: 'T-4', area: '', product: '' }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const data = { generated_at: '2026-10-31T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { _shared: 2, 'planner/front': 3, 'hq/dashboard/model': 4, 'dashboard/model': 1 }, invariants_total: 10, adversarial_evals: 1, regression_evals: 0, insight_reports: 1, last_insight: '2026-10-25-weekly.md', specs: 2 } };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch();
  for (const [name, vp] of [['desktop', { width: 1200, height: 1500 }], ['phone', { width: 390, height: 900 }]]) {
    const page = await browser.newPage({ viewport: vp }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await page.waitForTimeout(1200);
    const txt = s => page.$eval(s, e => e.textContent.trim());
    const cards = () => page.$$eval('#board .tcard', c => c.map(k => /T-\d+/.exec(k.textContent)[0]).sort().join());
    ok(await cards() === 'T-1,T-2,T-3,T-4', name + ': mặc định Tất cả hiện đủ 4 việc');
    await page.selectOption('#product-filter', 'hq'); await page.waitForTimeout(300);
    ok(await cards() === 'T-2,T-3', name + ': hq gồm cả việc vùng cũ dashboard/model, không có việc không sản phẩm');
    ok(await txt('#k-stuck') === '1' && await txt('#k-wip') === '1', name + ': KPI tính trên việc đã lọc');
    ok((await txt('#krTxt')).startsWith('6 bất biến'), name + ': số bất biến = _shared + hq (2+4)');
    ok(await txt('#nd_kr .lbl') === '2 vùng trong bể', name + ': chữ dưới khối bể theo sản phẩm');
    ok((await txt('#team thead')).includes('cả công ty'), name + ': Đội ngũ ghi nhãn cả công ty khi lọc');
    const rows = await page.$$eval('#nd_kr [data-kr-scope]', e => Object.fromEntries(e.map(x => [x.getAttribute('data-kr-scope'), x.textContent])));
    ok(JSON.stringify(rows) === JSON.stringify({ _shared: '_shared 2', planner: 'planner 3', hq: 'hq 4', khac: 'khác 1' }), name + ': cây bất biến luôn cả cây ' + JSON.stringify(rows));
    ok(await page.evaluate(() => localStorage.getItem('tohong.productFilter')) === 'hq', name + ': nhớ lựa chọn');
    await page.reload(); await page.waitForTimeout(1200);
    ok(await page.$eval('#product-filter', s => s.value) === 'hq' && await cards() === 'T-2,T-3', name + ': tải lại vẫn lọc hq ngay');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': không cuộn ngang');
    ok(!errors.length, name + ': không lỗi trang ' + errors.join(';'));
    await page.close();
  }
  await browser.close(); console.log(fails ? 'FAIL ' + fails : 'PASS'); process.exit(fails ? 1 : 0);
})();
