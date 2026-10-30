// Kiểm nhân vật Bản đồ luồng (T-019) bằng Playwright.
// Chạy: D3=/đường/dẫn/d3.min.js OUT=/thư/mục/ảnh node tests/characters.js
// (cdnjs có thể bị chặn nên d3 được nạp từ file cục bộ; dữ liệu và kênh live đều giả, không gọi mạng thật.)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.env.OUT || '/tmp/t019', D3 = process.env.D3;
fs.mkdirSync(OUT, { recursive: true });
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(root, 'index.html'))); });
const iso = d => new Date(d.getTime() + 7 * 36e5).toISOString().slice(0, 16);
const roster = [['capu','Capu','Hired'],['chief-of-staff','Chief of Staff','Hired'],['product','Product','Hired'],['engineering','Engineering','Hired'],['reviewer','Reviewer','Hired'],['vendor-ops','Vendor Ops','Need Hiring'],['growth','Growth','Need Hiring'],['finance','Finance','Need Hiring']].map(([id,name,status]) => ({ id, name, role: name, status, kind: 'agent' }));
const T = (id, state, holder, owner) => ({ id, title: 'Việc ' + id, state, holder, owner, reviewer: 'reviewer', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-29T08:00', updated: iso(new Date()) });
const ev = (id, task, event, from, to, t) => ({ id, t, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0 });
const data = { generated_at: iso(new Date()), roster,
  tasks: [T('T-100','doing','engineering','engineering'), T('T-101','review','reviewer','product'), T('T-102','doing','chief-of-staff','product')],
  events: [ev('E-1','T-100','assigned','chief-of-staff','engineering','2026-10-29T08:00'), ev('E-2','T-101','handoff','product','reviewer','2026-10-29T08:10')] };
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); };

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  for (const [label, width, height] of [['wide', 1280, 900], ['narrow', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    let sock; await page.routeWebSocket(/\/ws$/, ws => { sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
    await page.goto(url); await page.waitForSelector('.chr'); await page.waitForTimeout(400);
    const state = id => page.$eval(`.chr[data-agent="${id}"]`, e => e.dataset.state);
    const shot = async (name, clipId) => { const el = await page.$('#ban-do-luong'); await page.waitForTimeout(250); await el.screenshot({ path: `${OUT}/${label}-${name}.png` });
      for (const h of await page.$$('.chr')) { const [a, st] = await h.evaluate(n => [n.dataset.agent, n.dataset.state]); if (['idle','hiring'].includes(st) && name !== '1-idle-working-hiring') continue;
        const b = await h.boundingBox(); await page.screenshot({ path: `${OUT}/zoom-${label}-${st}-${a}.png`, clip: { x: b.x - 22, y: b.y - 16, width: 120, height: b.height + 40 } }); } };
    const send = o => sock.send(JSON.stringify(o));
    const push = async (o) => { send(o); await page.waitForTimeout(150); };
    const now = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 16);
    const e = (id, task, event, from, to, extra = {}) => ({ type: 'event', id, t: now(), task, event, from, to, round: 0, cost: 0, ...extra });

    // 1. idle / hiring / working từ dữ liệu tĩnh
    ok(`${label}: idle`, (await state('capu')) === 'idle', await state('capu'));
    ok(`${label}: hiring`, (await state('finance')) === 'hiring');
    ok(`${label}: working (wip>0)`, (await state('engineering')) === 'working');
    ok(`${label}: có 9 nhân vật`, (await page.$$('.chr')).length === 9);
    await shot('1-idle-working-hiring');
    // 2. working do activity live
    send({ type: 'activity', agent: 'product', action: 'Viết PRD', at: Date.now() }); await page.waitForTimeout(200);
    ok(`${label}: working (activity live)`, (await state('product')) === 'working' || (await state('product')) === 'handing-off');
    await shot('2-working-live');
    // 3. receiving + handing-off
    await push(e('L1', 'T-102', 'assigned', 'chief-of-staff', 'product'));
    ok(`${label}: receiving`, (await state('product')) === 'receiving', await state('product'));
    ok(`${label}: handing-off`, (await state('chief-of-staff')) === 'handing-off', await state('chief-of-staff'));
    await shot('3-receiving-handing-off');
    // 4. upset
    await push(e('L2', 'T-101', 'rejected', 'reviewer', 'product', { state: 'rework', holder: 'product' }));
    ok(`${label}: upset`, (await state('product')) === 'upset', await state('product'));
    await shot('4-upset');
    // 5. celebrating
    await push(e('L3', 'T-101', 'accepted', 'reviewer', 'done', { state: 'done', holder: 'done' }));
    ok(`${label}: celebrating reviewer + done`, (await state('reviewer')) === 'celebrating' && (await state('done')) === 'celebrating');
    await shot('5-celebrating');
    // 6. hết thời gian nhất thời -> về working/idle
    await page.waitForTimeout(5600);
    const after = [await state('product'), await state('reviewer'), await state('chief-of-staff'), await state('done')];
    ok(`${label}: nhất thời kết thúc`, !after.some(s => ['upset','celebrating','receiving','handing-off'].includes(s)), after.join(','));
    // tooltip + wip + tên còn nguyên
    ok(`${label}: wip badge`, (await page.$$('.wip-badge')).length === 8);
    ok(`${label}: act-ring còn`, (await page.$$('.act-ring')).length >= 1);
    // 7. reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' }); await push(e('L4', 'T-102', 'rejected', 'reviewer', 'engineering'));
    const anim = await page.$$eval('.chr-anim, .chr .c-arm, .chr .fx', els => els.filter(e => getComputedStyle(e).animationName !== 'none').length);
    ok(`${label}: reduced-motion tắt animation`, anim === 0, 'đang chạy: ' + anim);
    await shot('6-reduced-motion-upset');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // tooltip
    await page.hover('.chr[data-agent="reviewer"]', { force: true }); await page.waitForTimeout(150);
    ok(`${label}: tooltip có trạng thái`, /Trạng thái/.test(await page.$eval('.tip', e => e.textContent)));
    ok(`${label}: không lỗi console`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); srv.close();
  results.forEach(r => console.log(r.join('  ')));
  process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
})();
