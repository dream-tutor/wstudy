// 와와학습학원 (wstudycenter.com) 정적 페이지 생성기
// 실행: node build.js  → 폴더 루트에 페이지 생성 (center 저장소와 같은 배포 패턴)
const fs = require('fs');
const path = require('path');
const BRANCHES = require('./data/branches.json');
const VIDEOS = require('./data/videos.json');
const COPY = require('./lib/copy.js');
// style.css 내용 해시를 ?v=로 붙여 CSS 변경 시 브라우저·CDN 캐시(max-age 600)를 자동으로 깬다 (2026-09-07)
const CSS_V = require('crypto').createHash('md5').update(fs.readFileSync(path.join(__dirname, 'assets/style.css'))).digest('hex').slice(0, 8);
const GUIDES = [...require('./lib/guides-habit.js'), ...require('./lib/guides-subject.js'), ...require('./lib/guides-grade.js')];
const SCHOOL_INFO = fs.existsSync(path.join(__dirname, 'data', 'school-info.json')) ? require('./data/school-info.json') : {};
const REVIEWS = fs.existsSync(path.join(__dirname, 'data', 'reviews.json')) ? require('./data/reviews.json') : [];
const SCHOOL_GEO = fs.existsSync(path.join(__dirname, 'data', 'school-geo.json')) ? require('./data/school-geo.json') : {};
const SCHOOL_CODES = fs.existsSync(path.join(__dirname, 'data', 'school-codes.json')) ? require('./data/school-codes.json') : {};

const ROOT = __dirname;
const DOMAIN = 'https://wstudycenter.com';
const BRAND = '와와학습학원';
const TEL = '010-4864-5345';
const PRIVACY_EMAIL = 'zskykr@naver.com';
const GAS = 'https://script.google.com/macros/s/AKfycbybsuTZMjzlp3HkkVaUX0IUFnNlSfnnN0DGThb-2BOIwZ8IyZNnMgkwoWOb_muHCEx5/exec';
const TRACKER = '<script defer src="https://xn--vb0by3y5wigqb.com/t.js" data-site="wstudy"></script>';
// 텍스트 선택·우클릭·F12 차단 스크립트(WAWA_AUTO_PROTECT)는 2026-09-17 점검(code#12)으로 뺐다. 학부모가 지점 주소를 복사해 지도 앱에 붙여 넣지 못하는 부작용이 있어
// 과외 4사이트(2026-09-15)와 같은 결정을 따른다. 다시 넣지 말 것.
const SUBJ_SLUG = { 영어: 'english', 수학: 'math', 국어: 'korean', 과학: 'science', 사회: 'social' };

// ── 유틸 ──
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
function pick(arr, key) { return arr[hash(key) % arr.length]; }
// 페이지별 날짜 — URL 시드 기반, 월 단위로만 변동 (학교별과외 seo.js pageDates와 같은 방식)
//   dateModified: 이번 달 안에서 시드로 고정한 날(1~28일). 아직 오지 않은 날이면 지난달 같은 날.
//   datePublished: 시드로 2026-07-13 ~ 2026-08-15 사이에 고정 분산 (빌드 시각과 무관).
//   sitemap <lastmod>도 같은 값을 쓴다. 주 단위 랜덤 회전은 넣지 말 것.
const SITE_LAUNCH_EPOCH = Date.UTC(2026, 6, 13);
const LAUNCH_SPAN_DAYS = 34; // 2026-07-13 ~ 2026-08-15
function seedHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// 시드 발행일 구간(07-13~08-15)보다 뒤에 생긴 페이지와 본문을 다시 쓴 페이지 (data/page-dates.json, 2026-09-17 검증 퇴행 보완)
//   born[주소]    처음 공개한 날. datePublished는 이 날로 둔다(시드 날짜로 만든 날보다 앞선 발행일을 내세우지 않도록).
//   revised[주소] 본문을 크게 다시 쓴 날. 시드 수정일이 이보다 앞서면 이 날로 둔다(다음 달부터는 시드 날짜가 더 늦어 그대로 간다).
//   born은 빌드가 채운다: 직전 sitemap.xml에 없던 색인 페이지를 오늘(KST) 날짜로 적고 파일을 다시 쓴다.
//   revised는 원고를 크게 고쳤을 때 손으로 적는다. 날짜를 앞당기거나 주기적으로 바꾸는 데 쓰지 말 것.
const PAGE_DATES_FILE = path.join(__dirname, 'data', 'page-dates.json');
const PAGE_DATES = (() => { try { return JSON.parse(fs.readFileSync(PAGE_DATES_FILE, 'utf8')); } catch (e) { return {}; } })();
for (const k of ['born', 'revised']) if (!PAGE_DATES[k] || typeof PAGE_DATES[k] !== 'object') PAGE_DATES[k] = {};
const TODAY_KST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
function dateKey(seed) {
  let s = String(seed == null ? '' : seed);
  try { s = decodeURIComponent(s); } catch (e) {}
  return '/' + s.replace(/^\/+/, ''); // '/busan/bukgu/' 형태로 정규화 (shell·sitemap이 같은 시드를 쓰도록)
}
// 직전 빌드의 사이트맵 주소. 파일이 없거나 비정상적으로 작으면(1,000개 미만) 새 페이지 판정을 하지 않는다.
const PREV_SITEMAP = (() => {
  try {
    const xml = fs.readFileSync(path.join(__dirname, 'sitemap.xml'), 'utf8');
    const set = new Set([...xml.matchAll(/<loc>https:\/\/wstudycenter\.com([^<]*)<\/loc>/g)].map((m) => dateKey(m[1])));
    return set.size >= 1000 ? set : null;
  } catch (e) { return null; }
})();
const PAGE_BORN_NEW = [];
function noteNewPage(seed) {
  if (!PREV_SITEMAP) return;
  const k = dateKey(seed);
  if (PREV_SITEMAP.has(k) || PAGE_DATES.born[k]) return;
  PAGE_DATES.born[k] = TODAY_KST;
  PAGE_BORN_NEW.push(k);
}
function pageDates(seed) {
  const s = dateKey(seed);
  const h = seedHash(s);
  const h2 = seedHash('m:' + s);
  const born = PAGE_DATES.born[s];
  const revised = PAGE_DATES.revised[s];
  const published = born ? new Date(born + 'T00:00:00Z') : new Date(SITE_LAUNCH_EPOCH + (h % LAUNCH_SPAN_DAYS) * 86400000);
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000); // KST 기준 오늘
  const y = nowKst.getUTCFullYear();
  const m = nowKst.getUTCMonth();
  const dayOff = h2 % 28;
  let modified = new Date(Date.UTC(y, m, 1 + dayOff));
  if (modified.getTime() > nowKst.getTime()) modified = new Date(Date.UTC(y, m - 1, 1 + dayOff));
  if (revised && modified.getTime() < new Date(revised + 'T00:00:00Z').getTime()) modified = new Date(revised + 'T00:00:00Z');
  if (modified.getTime() < published.getTime()) modified = published; // 수정일이 발행일보다 앞설 수 없음
  const iso = (d) => d.toISOString().slice(0, 10);
  return { datePublished: iso(published), dateModified: iso(modified) };
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function write(rel, html) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, 'utf8');
  urls.push(rel.replace(/index\.html$/, '').replace(/\\/g, '/'));
}
// "초3,초4,초5,중1,중2" → "초3~초5, 중1~중2" (연속 구간 축약)
const GRADE_SEQ = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
function gradeRange(g) {
  if (!g) return g;
  const idx = String(g).split(',').map((s) => GRADE_SEQ.indexOf(s.trim())).filter((i) => i >= 0).sort((a, b) => a - b);
  if (!idx.length) return g;
  const runs = [];
  let s = idx[0], p = idx[0];
  for (let k = 1; k < idx.length; k++) {
    if (idx[k] === p) continue;
    if (idx[k] === p + 1) { p = idx[k]; continue; }
    runs.push([s, p]); s = p = idx[k];
  }
  runs.push([s, p]);
  return runs.map(([a, b]) => (a === b ? GRADE_SEQ[a] : `${GRADE_SEQ[a]}~${GRADE_SEQ[b]}`)).join(', ');
}
// 데이터 공백 정리 — "( 대림프라자" 같은 원본 표기 정돈
function cleanTxt(s) { return String(s || '').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/[ \t]+/g, ' ').trim(); }
// 수업 시간 칸 표시용 정규화 (기준본 branches.json은 그대로 둔다 — 2026-09-17 점검 copy#15)
// 주말 칸은 지점이 손으로 적은 메모('주말불가', '가능함', '조율', 특강 광고 문구 등)라 정해진 표현으로만 옮긴다. wawaguide weekendOf와 같은 규칙.
function weekendTxt(b) {
  const s = String(b.weekend || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (/둘\s*다\s*불가/.test(s) || /^주말\s*불가$/.test(s)) return '주말 수업 없음';
  // '토일부가능'은 토요일에 일부 과목만 가능하다는 뜻이다(2026-09-18 사용자 확인). '토요일 일부 가능'·'일요일 일부 가능'도 같게 본다
  if (/일부/.test(s)) { const d = /일요일/.test(s) ? (/토요일|토\s/.test(s) ? '토·일' : '일요일') : '토요일'; return `${d} 일부 과목 수업 있음(과목·시간은 상담 시 안내)`; }
  const sat = /토/.test(s) && !/토요일[^,/.]*불가/.test(s);
  const sun = /일요일|토\s*[.,/]\s*일|토일/.test(s) && !/일요일\s*불가/.test(s);
  if (sat && sun && /자습/.test(s)) return '토요일 수업 있음, 시험 기간 일요일 자습 운영(상담 시 안내)';
  if (sat && sun) return '토·일 수업 있음(요일·과목은 상담 시 안내)';
  if (sat) return '토요일 수업 있음(과목·시간은 상담 시 안내)';
  if (sun) return '일요일 수업 있음(과목·시간은 상담 시 안내)';
  if (/시험|내신/.test(s)) return '시험 기간에 주말 수업 운영(상담 시 안내)';
  if (/보강/.test(s)) return '주말 보강 수업 운영(상담 시 안내)';
  if (/조율|협의/.test(s)) return '주말 수업은 상담 시 조율';
  if (/가능/.test(s)) return '주말 수업 있음(상담 시 안내)';
  return '';
}
// 평일 칸: 띄어쓰기 통일('평일오후1시이후' → '평일 오후 1시 이후', '2시반' → '2시 30분').
// 원자료가 '평일 오전 11시 이후'인 지점(반월당·비전·내발산)은 오전 수업을 안내하지 않는 정책이라 시각을 적지 않되,
// 원자료와 어긋나는 '평일 오후'로 바꿔 쓰지도 않는다. '평일'만 두고 시작 시간은 상담 안내로 돌린다 (2026-09-17 검증 퇴행 보완).
function openTimeTxt(b) {
  let t = String(b.open_time || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/오전/.test(t)) return '평일 수업(시작 시간은 상담 시 안내)';
  return t.replace(/평일\s*오후\s*/, '평일 오후 ').replace(/(\d)시반/, '$1시 30분').replace(/(\d)시(\d)/, '$1시 $2').replace(/(시|분)\s*이후/, '$1 이후').trim();
}
function hoursTxt(b) { return [openTimeTxt(b) || '상담 시 안내', weekendTxt(b)].filter(Boolean).join(' · '); }

// 수강료: wcoachingcenter.com과 동일한 회비 표 (와와회비A/B, 학년 × 주2·3·5회 월액)
const FEE_TABLES = {
  A: { 초등: ['160,000', '230,000', '370,000'], 중등: ['172,000', '247,000', '397,000'], 고등: ['195,000', '280,000', '450,000'] },
  B: { 초등: ['140,000', '200,000', '320,000'], 중등: ['152,000', '217,000', '347,000'], 고등: ['175,000', '250,000', '400,000'] },
};
// 요금 등급: data/branches.json fee_type(원본 엑셀 '회비종류'). 'A'가 들어 있으면 와와회비A, 나머지(오타 '와외회비B' 포함)는 B.
function feeGrade(b) { return /A/.test(b.fee_type || '') ? 'A' : 'B'; }
// 1회 수업 시간(분) — '90분'처럼 단위가 붙은 값도 숫자로 읽는다. 20분 이하(원자료 오기)는 상담 안내로.
function lessonMin(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return n > 20 ? `${n}분` : '상담 시 안내'; }
// 교습비를 보여 주는 곳마다 붙이는 표기: 정식 학원 명칭 · 교육청 등록번호 · 교습비 공시 자료 (와와 마케팅 가이드 필수 표기)
function feeWho(b) {
  return `<span class="fw-name">${esc(b.office || BRAND + ' ' + b.name)}</span>${b.reg ? `<span class="fw-reg">등록번호 ${esc(b.reg)}</span>` : ''}${b.fee_link ? `<a class="fee-doc" href="${esc(b.fee_link)}" target="_blank" rel="noopener">교습비 공시 자료</a>` : ''}`;
}
function feeSection(b) {
  const t = FEE_TABLES[feeGrade(b)];
  const mins = { 초등: b.time_elem, 중등: b.time_mid, 고등: b.time_high };
  const rows = Object.entries(t).map(([lv, p]) => `<tr><th>${lv}</th><td class="tm">${lessonMin(mins[lv])}</td><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td></tr>`).join('');
  return `<h2 id="fee">수강료 안내</h2><p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">${esc(b.name)}의 월 교습비 기준표(원)입니다. 지점에 등록된 교습비는 표 아래 교습비 공시 자료에서 확인할 수 있고, 수업 시간과 횟수는 상담에서 정합니다.</p>
<div class="tbl-scroll"><table class="info-table fee-table"><thead><tr><th>학년</th><th class="tm">1회 수업</th><th>주2회</th><th>주3회</th><th>주5회</th></tr></thead><tbody>${rows}</tbody></table></div><div class="fee-legal">${feeWho(b)}</div>`;
}
// 학교 페이지용: 해당 학교 학년(초/중/고)에 맞춘 지점별 교습비. 지점마다 금액 줄 바로 아래에 그 금액의 학원 명칭·등록번호·공시 자료 줄을 붙인다.
function schoolFeeSection(s) {
  const lv = s.level === '초' ? '초등' : s.level === '중' ? '중등' : '고등';
  const minKey = { 초등: 'time_elem', 중등: 'time_mid', 고등: 'time_high' }[lv];
  const many = s.branches.length > 1;
  const rows = s.branches.map((b) => {
    const p = FEE_TABLES[feeGrade(b)][lv];
    return `<tr class="fee-row"><th><a href="../../${b.branch_slug}/#fee" style="color:var(--brick);font-weight:600">${esc(b.name)}</a></th><td class="tm">${lessonMin(b[minKey])}</td><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td></tr><tr class="fee-who"><td colspan="5"><div class="fee-legal">${feeWho(b)}</div></td></tr>`;
  }).join('');
  return `<h2 id="fee">${esc(s.name)} 학생 수강료 안내</h2><p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">${lv}부 월 교습비 기준표(원)입니다. ${many ? '지점마다 금액과 1회 수업 시간이 다를 수 있어 지점별로 나눠 적었고, ' : ''}금액 아래에 학원 정식 명칭과 교육청 등록번호, 교습비 공시 자료를 함께 두었습니다. 수업 시간과 횟수는 상담에서 정합니다.</p>
<div class="tbl-scroll"><table class="info-table fee-table"><thead><tr><th>지점</th><th class="tm">1회 수업</th><th>주2회</th><th>주3회</th><th>주5회</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ── 데이터 구조화 ──
// 학교명 정규화: "쌍용초.미라초." / "나곡중/보라중/상갈중" / "양덕중 장흥중"처럼 붙은 항목을 분리 (경로 문자 제거)
// 공백·쉼표도 나눈다 — 공백으로 이어 적은 항목이 학교 하나로 묶여 가짜 학교 페이지 18쪽이 생겼다 (2026-09-17 점검 code#1·copy#1, 기준본도 같이 고침)
function normSchools(arr) {
  const out = [];
  for (const s of arr || []) for (const p of String(s).split(/[./\\,\s]+/)) { const t = p.trim(); if (t.length >= 2 && !out.includes(t)) out.push(t); }
  return out;
}
// 데이터 점검 경고 — 기준본 오타가 제목·H1으로 번지기 전에 빌드 로그에서 보이게 한다 (2026-09-17 점검 code#3)
const DATA_WARN = [];
const regions = {}; // region_slug -> {name, districts: {district_slug: {name, branches:[]}}}
for (const [name, b] of Object.entries(BRANCHES)) {
  b.name = name;
  for (const f of ['schools_elem', 'schools_mid', 'schools_high']) for (const s of b[f] || []) if (/[\s,]/.test(String(s).trim())) DATA_WARN.push(`${name} ${f} 학교 항목에 공백·쉼표: "${s}"`);
  if (!/(동|읍|면|가|리)$/.test(b.dong || '')) DATA_WARN.push(`${name} dong이 동·읍·면·가·리로 끝나지 않음: "${b.dong}"`);
  { const stem = String(b.dong || '').replace(/(동|읍|면|가|리)$/, ''); if (stem && ![b.nearby_text, b.address, name].some((t) => String(t || '').includes(stem))) DATA_WARN.push(`${name} dong "${b.dong}"이 주소·주변 안내·지점명에 없음 (오타인지 확인)`); }
  // 시군구가 없는 세종특별자치시는 '세종시'로 채운다. URL 슬러그(unknown)는 이미 색인된 주소라 바꾸지 않는다 (copy#6)
  if (!b.district) { DATA_WARN.push(`${name} district 빈값 → 대체 표기`); b.district = b.region === '세종' ? '세종시' : b.region; }
  // 동탄 지점은 동 이름만 쓰면 '목동'처럼 다른 지역과 겹친다. 제목·H1·칩에 쓰는 동 표기에 '동탄'을 붙인다 (기준본은 그대로)
  if (/^동탄/.test(name) && b.dong && !b.dong.includes('동탄')) b.dong = '동탄 ' + b.dong;
  b.schools_elem = normSchools(b.schools_elem);
  b.schools_mid = normSchools(b.schools_mid);
  b.schools_high = normSchools(b.schools_high);
  b.address = cleanTxt(b.address);
  // 지점 원문 안내의 느낌표('4층입니다!')는 안내문 톤에 맞춰 마침표로 (표시용, 기준본은 그대로)
  if (b.location_guide) b.location_guide = String(b.location_guide).split(/\n+/).map((x) => cleanTxt(x).replace(/!+/g, '.')).filter(Boolean).join('\n');
  const r = (regions[b.region_slug] = regions[b.region_slug] || { name: b.region, slug: b.region_slug, districts: {} });
  const d = (r.districts[b.district_slug] = r.districts[b.district_slug] || { name: b.district, slug: b.district_slug, branches: [] });
  d.branches.push(b);
}
// 시도+시군구 표기: '세종 세종시'처럼 겹치면 시군구만 쓴다
function rdName(region, district) { return district && district.startsWith(region) ? district : [region, district].filter(Boolean).join(' '); }
// 과목 개설 학교급: grades_by_subject[과목]에 그 학교급(초·중·고) 학년이 있으면 개설. 값이 비면 개설 정보가 없는 것이라 막지 않는다 (2026-09-17 점검 code#2)
function offered(b, subj, level) {
  const g = String((b.grades_by_subject || {})[subj] || '').trim();
  if (!g) return true;
  return g.split(',').some((x) => x.trim()[0] === level);
}
function subjLevels(b, subj) {
  const g = String((b.grades_by_subject || {})[subj] || '').trim();
  if (!g) return null;
  const set = new Set(g.split(',').map((x) => x.trim()[0]));
  const lv = ['초', '중', '고'].filter((c) => set.has(c));
  return lv.length ? lv : null;
}
// description: 네이버 권고 80자 안에서 가장 긴 후보를 쓴다 (2026-09-17 점검 code#8). 후보는 긴 것부터 넘긴다.
function fitDesc(...cands) {
  const clean = cands.filter(Boolean).map((c) => String(c).replace(/\s+/g, ' ').trim());
  return clean.find((c) => c.length <= 80) || clean[clean.length - 1];
}
// 학교 인덱스: region/district/학교명 -> {level, branches:[]}
const schools = {};
for (const b of Object.values(BRANCHES)) {
  for (const [field, level] of [['schools_elem', '초'], ['schools_mid', '중'], ['schools_high', '고']]) {
    for (const s of b[field] || []) {
      const key = `${b.region_slug}/${b.district_slug}/${s}`;
      const e = (schools[key] = schools[key] || { name: s, level, region_slug: b.region_slug, district_slug: b.district_slug, region: b.region, district: b.district, branches: [] });
      if (!e.branches.includes(b)) e.branches.push(b);
    }
  }
}
const urls = [];

// ── 공통 레이아웃 ──
// rootAbs: 404.html처럼 어느 깊이의 주소에서든 같은 파일이 뜨는 페이지는 상대경로 대신 '/'로 시작하는 경로를 쓴다
function shell({ title, desc, canonical, body, depth, ld, ogTitle, footExtra, branch = '', robots = '', fixedDate = '', rootAbs = false }) {
  // 지점 페이지에서는 모든 상담 CTA 가 해당 지점을 달고 이동한다
  const cq = branch ? `?지점=${encodeURIComponent(branch)}` : '';
  const base = rootAbs ? '/' : depth ? '../'.repeat(depth) : './';
  // 페이지 LD + 브레드크럼 LD 병합 (@graph)
  const graph = [];
  if (ld) { if (ld['@graph']) graph.push(...ld['@graph']); else { const o = { ...ld }; delete o['@context']; graph.push(o); } }
  if (CRUMB_LD) { graph.push(CRUMB_LD); CRUMB_LD = null; }
  // 페이지 날짜 (URL 시드·월 단위) — WebPage LD + article:*_time 메타 + 브레드크럼 옆 표시 문구
  // fixedDate: 시행일이 본문에 적힌 페이지(개인정보처리방침)는 URL 시드 날짜 대신 그 날짜를 쓴다
  // 새 색인 페이지는 처음 만든 날을 born에 적어 발행일로 쓴다 (noindex 페이지는 사이트맵에 없으니 판정하지 않는다)
  if (!fixedDate && !/noindex/.test(robots)) noteNewPage(canonical.replace(DOMAIN, ''));
  const { datePublished, dateModified } = fixedDate ? { datePublished: fixedDate, dateModified: fixedDate } : pageDates(canonical.replace(DOMAIN, ''));
  graph.push({ '@type': 'WebPage', name: title, description: desc, url: canonical, datePublished, dateModified, inLanguage: 'ko-KR' });
  const ldJson = graph.length ? JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) : '';
  const bodyOut = body.replace(/__UPD_ISO__/g, dateModified).replace(/__UPD_DOT__/g, dateModified.replace(/-/g, '.'));
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="google-site-verification" content="3P6p9NW99Ly9i5ZQceo8vY71GaL1MPSoS9gVdI0UXKk">
<meta name="naver-site-verification" content="3663cc9fe37352a1d7c03c5375c22ebb4275d9f4">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">${robots ? `\n<meta name="robots" content="${robots}">` : ''}
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:image" content="${DOMAIN}/assets/wawa-class.jpg">
<meta property="og:image:width" content="900">
<meta property="og:image:height" content="664">
<meta name="twitter:card" content="summary_large_image">
<meta property="article:published_time" content="${datePublished}T00:00:00+09:00">
<meta property="article:modified_time" content="${dateModified}T00:00:00+09:00">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/style.css?v=${CSS_V}">
${ldJson ? `<script type="application/ld+json">${ldJson}</script>` : ''}
</head>
<body>
<div class="topbar"><span>초·중·고 교과 전문 ${BRAND}</span><a href="tel:${TEL}">전화 상담</a></div>
<header class="site"><div class="in">
<a class="logo" href="${base}">와와학습학원<span class="dot">.</span></a>
<nav class="gnb"><a class="cta" href="${base}inquiry/${cq}">상담 신청</a></nav>
</div></header>
${bodyOut}
<footer class="site"><div class="in">
<div class="brand">${BRAND}</div>
전국 지점에서 초·중·고 교과 수업과 학교별 내신 관리를 합니다.<br>
<a href="tel:${TEL}">전화 상담</a> · <a href="${base}inquiry/${cq}">상담 신청</a> · <a href="${base}review/">수강후기</a> · <a href="${base}guide/">공부법 칼럼</a> · <a href="${base}grade-calculator/">내신 등급 계산기</a> · <a href="${base}privacy/">개인정보처리방침</a><br>
학원 등록번호는 각 지점 페이지에 표기되어 있습니다. © ${BRAND}
<div style="margin-top:8px;font-size:12px;opacity:.8"><time datetime="${dateModified}">정보 업데이트 ${dateModified.replace(/-/g, '.')}</time></div>
${(() => { const s = []; if (/assets\/(illust\/|wawa-class)/.test(body)) s.push('사진 출처: 와와학습코칭센터, AI로 이미지 생성'); if (/class="video-box"/.test(body)) s.push('영상 출처: 유튜브 와와학습코칭센터'); return s.length ? '<div style="margin-top:8px;font-size:11px;opacity:.75">' + s.join(' · ') + '</div>' : ''; })()}
${footExtra ? `<div class="foot-reg">${footExtra}</div>` : ''}
</div></footer>
<div class="float-cta"><a class="f-form" href="${base}inquiry/${cq}">상담 문의</a><a class="f-tel" href="tel:${TEL}">전화 상담</a></div>
<div id="cOv" class="c-ov" hidden><div class="c-box"><button type="button" class="c-x" aria-label="닫기">×</button><iframe id="cFrame" title="상담 신청"></iframe></div></div>
<script>
(function(){
  if(location.search.indexOf('embed=1')>-1)return;
  var ov=document.getElementById('cOv'),fr=document.getElementById('cFrame');
  if(!ov)return;
  function openM(href){
    var u=new URL(href,location.href);
    u.searchParams.set('embed','1');
    fr.src=u.pathname+u.search;
    ov.hidden=false;document.body.style.overflow='hidden';
  }
  function closeM(){ov.hidden=true;fr.src='about:blank';document.body.style.overflow='';}
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href*="inquiry"]');
    if(!a)return;
    e.preventDefault();openM(a.getAttribute('href'));
  });
  ov.addEventListener('click',function(e){if(e.target===ov)closeM();});
  document.querySelector('.c-x').addEventListener('click',closeM);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!ov.hidden)closeM();});
})();
(function(){
  // 썸네일 대체: 없는 해상도는 404여도 120x90 자리표시 이미지가 오므로 크기로 판단해 다음 후보로 교체
  function fb(img){var f=(img.dataset.fb||'').split(',').filter(Boolean);if(img.naturalWidth>120||!f.length)return;img.dataset.fb=f.slice(1).join(',');img.src=img.src.replace(/[^/]+\.jpg$/,f[0]+'.jpg');}
  var imgs=document.querySelectorAll('.frame[data-yt] img');
  for(var i=0;i<imgs.length;i++){(function(img){img.addEventListener('load',function(){fb(img)});img.addEventListener('error',function(){fb(img)});if(img.complete&&img.naturalWidth)fb(img);})(imgs[i]);}
  document.addEventListener('click',function(e){
    var f=e.target.closest('.frame[data-yt]');
    if(!f||f.classList.contains('on'))return;
    var ifr=document.createElement('iframe');
    ifr.src='https://www.youtube-nocookie.com/embed/'+f.getAttribute('data-yt')+'?autoplay=1&rel=0&playsinline=1';
    ifr.title=f.getAttribute('data-title')||'와와 영상';
    ifr.setAttribute('allow','accelerometer; autoplay; encrypted-media; picture-in-picture');
    ifr.setAttribute('allowfullscreen','');
    f.classList.add('on');f.innerHTML='';f.appendChild(ifr);
  });
})();
</script>
<script>document.documentElement.classList.add('js');(function(){var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('rv-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'}):null;document.querySelectorAll('.rv,.st').forEach(function(el){io?io.observe(el):el.classList.add('rv-in')});var hd=document.querySelector('header.site');if(hd){var t=false;window.addEventListener('scroll',function(){var s=window.scrollY>8;if(s!==t){t=s;hd.classList.toggle('hd-s',s)}},{passive:true})}var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;document.querySelectorAll('.blk-h').forEach(function(h){h.addEventListener('click',function(){if(window.innerWidth>=768)return;h.parentNode.classList.toggle('blk-open')})});document.querySelectorAll('.hero .stats .n').forEach(function(el){var m=el.textContent.match(/^([\\d,]+)(.*)$/);if(!m||rm)return;var to=parseInt(m[1].replace(/,/g,''),10),suf=m[2],t0=null,dur=1400;function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/dur);p=1-Math.pow(1-p,3);el.textContent=Math.round(to*p).toLocaleString()+suf;if(p<1)requestAnimationFrame(step)}el.textContent='0'+suf;setTimeout(function(){requestAnimationFrame(step)},650)})})();</script>
${TRACKER}
</body>
</html>`;
}
let CRUMB_LD = null; // crumb() 직후 shell()이 소비 (페이지 생성이 동기라 안전)
function crumb(depth, items) {
  const base = '../'.repeat(depth);
  let html = `<div class="crumb"><a href="${base}">홈</a>`;
  let acc = base;
  let accUrl = DOMAIN + '/';
  const ldItems = [{ '@type': 'ListItem', position: 1, name: '홈', item: DOMAIN + '/' }];
  for (let i = 0; i < items.length; i++) {
    if (i < items.length - 1) {
      acc += items[i].slug + '/';
      accUrl += encodeURIComponent(items[i].slug) + '/';
      html += `<span>›</span><a href="${acc}">${esc(items[i].name)}</a>`;
      ldItems.push({ '@type': 'ListItem', position: i + 2, name: items[i].name, item: accUrl });
    } else {
      html += `<span>›</span>${esc(items[i].name)}`;
      ldItems.push({ '@type': 'ListItem', position: i + 2, name: items[i].name });
    }
  }
  CRUMB_LD = { '@type': 'BreadcrumbList', itemListElement: ldItems };
  // 날짜 토큰은 shell()이 페이지 dateModified로 치환 (crumb는 경로를 모르므로)
  return html + '</div>'; // 정보 업데이트 날짜는 푸터에 표시 (2026-09-07: 브레드크럼 옆 표기 제거)
}
// 유튜브: 썸네일+재생 버튼 파사드(제목바·로고 없이 노출, 누르면 iframe 자동재생). 쇼츠는 세로 크롭(wcoachingcenter와 동일)
// alt·aria-label·iframe title에는 유튜브 원제(v.title) 대신 cap을 쓴다. 원제에 '성적은 우리가 책임진다', '1등급', '합격생' 같은
// 보증·실적 문구가 있어 스크린리더·이미지 검색에 그대로 나가던 것을 막는다 (2026-09-17 점검 copy#12). videos.json의 title은 원제 기록으로만 둔다.
function video(v, cap) {
  if (!v) return '';
  const vert = !!v.shorts;
  const thumbs = vert ? ['oardefault', 'hqdefault'] : ['hq720', 'sddefault', 'hqdefault'];
  const label = cap || '와와 공식 채널 영상';
  return `<div class="video-box rv"><div class="frame${vert ? ' vertical' : ''}" data-yt="${v.id}" data-title="${esc(label)}"><img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/${thumbs[0]}.jpg" data-fb="${thumbs.slice(1).join(',')}" alt="${esc(label)}" width="${vert ? 300 : 1280}" height="${vert ? 533 : 720}"><button type="button" class="yt-play" aria-label="${esc(label)} 재생"><span></span></button></div></div>`;
}
// 브랜드 영상 풀에서 고른 영상의 대체 텍스트 (특정 내용을 약속하지 않는 중립 문구)
const VIDEO_CAPS = ['와와 공식 채널 영상', '와와학습학원 관련 영상', '와와 유튜브 채널 영상'];
function ctaBand(b, depth) {
  const base = '../'.repeat(depth);
  const q = b ? '?지점=' + encodeURIComponent(b.name) : '';
  // 카카오 '장소' 링크는 등록업체 페이지로 연결돼 센터 대표번호가 노출된다.
  // 좌표 길찾기로만 보낸다 (2026-08-20). 되돌리지 말 것.
  // 링크 이름에 쉼표·슬래시가 남으면 카카오가 목적지 없는 화면이나 404로 보낸다 (노형·삼각산 등 7지점, 2026-09-17 점검 code#4).
  // 도로명+건물번호 뒤에 쉼표·괄호가 바로 붙는 주소도 끊고, 남은 쉼표·슬래시는 공백으로 바꾼다. 위치는 좌표가 정한다.
  const _road = (a) => {
    const t = String(a || '').trim();
    const m = t.match(/^(.*(?:로|길)\s*\d+(?:-\d+)?)(?=[\s,(/]|$)/);
    const r = m ? m[1].trim() : t.replace(/\s*(제?\S*\d+호|\S*\d+층)(?=[\s,(]|$).*$/, '').replace(/\s*와와\S*$/, '').replace(/\s+\d+$/, '').trim();
    return r.replace(/[,/]+/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const kko = b && b.lat && b.lng
    ? `https://map.kakao.com/link/to/${encodeURIComponent(_road(b.address) || b.name || '')},${b.lat},${b.lng}`
    : '';
  return `<div class="cta-band"><div class="t">상담 안내</div><div class="d">${pick(['학생의 학교, 학년, 현재 성적을 알려 주시면 필요한 수업을 구체적으로 안내해 드립니다.', '학교와 학년, 궁금한 과목을 남겨 주시면 지점에서 연락드려 수업 방법과 시간을 안내합니다.', '지금 성적과 다니는 학교를 알려 주시면 어느 단원부터 시작하면 좋을지 상담에서 정리해 드립니다.'], ((b && b.name) || 'home') + 'cta')}</div><div class="btns"><a class="tel" href="tel:${TEL}">전화 상담</a><a class="form" href="${base}inquiry/${q}">상담 신청서 작성</a>${kko ? `<a class="map" href="${kko}" target="_blank" rel="noopener">카카오맵 길찾기</a>` : ''}</div></div>`;
}
function faqHtml(items, ctx) {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };
  let html = '<h2>자주 묻는 질문</h2><div class="faq">';
  for (const f of items) {
    const a = f.a(ctx);
    html += `<details><summary>${esc(f.q)}</summary><p>${esc(a)}</p></details>`;
    ld.mainEntity.push({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  return { html: html + '</div>', ld };
}
// 관련 칼럼 링크 블록
function guideLinks(slugs, depth, title) {
  const base = '../'.repeat(depth);
  const items = slugs.map((s) => GUIDES.find((g) => g.slug === s)).filter(Boolean);
  if (!items.length) return '';
  return `<h2>${title || '함께 읽을 공부법 칼럼'}</h2><div class="chips st">${items.map((g) => `<a href="${base}guide/${g.slug}/">${esc(g.title)}</a>`).join('')}</div>`;
}
const SUBJ_GUIDES = {
  영어: ['english-voca', 'english-grammar', 'exam-4weeks'],
  수학: ['math-wrong', 'math-advance', 'exam-4weeks'],
  국어: ['korean-textbook', 'korean-nonfiction', 'exam-4weeks'],
  과학: ['science-explain', 'science-calc', 'exam-4weeks'],
  사회: ['social-structure', 'social-essay', 'exam-4weeks'],
};
// 전문관 배지 (글로리드=국어, W+=수학·과학)
function specBadge(name) {
  if (name.includes('글로리드')) return '<span class="tag spec">국어 전문관</span>';
  if (name.includes('W+')) return '<span class="tag spec">수학·과학 전문관</span>';
  return '';
}
// 주변 안내 토막('탄현마을12단지 인근 / 일산고등학교 인근')은 구분자를 두고 잇는다 (2026-09-17 점검 code#13)
function nearbyRow(b) {
  const nb = (b.nearby_text || '').split('/').slice(1).map((s) => cleanTxt(s)).filter(Boolean).join(' · ');
  return nb ? `<tr><th>주변</th><td>${esc(nb)}</td></tr>` : '';
}
// 지점 위치 지도 (Leaflet + OSM 래스터 타일 — 키 불필요)
// OSM 임베드(export/embed.html)는 2026-08 MapLibre GL로 바뀌어 WebGL이 꺼진 환경에서
// "브라우저가 WebGL을 지원하지 않습니다"만 뜬다. 허브 지도(branchesMap)와 같은 래스터 방식으로 통일.
function osmMap(b) {
  if (!b.lat || !b.lng) return '';
  return `<h2>오시는 길</h2><div class="mapbox"><div id="bmap" class="bmap"></div><div class="cap">${esc(b.address)}${b.nearby_text ? ' · ' + esc((b.nearby_text.split('/')[1] || '').trim()) : ''}</div></div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var m=L.map('bmap',{scrollWheelZoom:false}).setView([${b.lat},${b.lng}],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(m);
  L.marker([${b.lat},${b.lng}]).addTo(m).bindPopup(${JSON.stringify(b.name)});
})();
</script>`;
}
// 주소에서 일반구 추출 — "경기 수원시 장안구 …" → "장안구" (없으면 null)
function guOf(b) {
  const m = (b.address || '').match(/[가-힣]+시\s+([가-힣]{1,6}구)(?=\s)/);
  return m ? m[1] : null;
}
// 지역·시군구 허브용 지점 마커 지도 (Leaflet + OSM 타일, 키 불필요)
// withFilter=true면 시/군/구 선택 셀렉트가 붙고, 고르면 해당 지역 마커만 남기고 확대
function branchesMap(pts, levels, school) {
  const valid = pts.filter((p) => p.la && p.lo);
  if (!valid.length) return '';
  levels = levels || [];
  const LABEL = { city: '시/군/구', gu: '구', dong: '읍/면/동' };
  const selHtml = levels.length
    ? `<div class="sec-sub" style="margin:10px 0 6px">지역을 차례로 선택하면 지도가 그 지역으로 좁혀집니다.</div>
<div class="map-sels">${levels.map((l) => `<select id="ms_${l}"><option value="">${LABEL[l]} 전체</option></select>`).join('')}</div>`
    : '';
  return `<h2>지점 위치</h2>
${selHtml}
<div id="lmap" class="lmap"></div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var pts=${JSON.stringify(valid)};
  var LV=${JSON.stringify(levels)};
  var LB=${JSON.stringify(LABEL)};
  var map=L.map('lmap',{scrollWheelZoom:false});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
  pts.forEach(function(p){p._m=L.marker([p.la,p.lo]).addTo(map).bindPopup('<b>'+p.n+'</b><br><a href="'+p.u+'">지점 안내 보기 →</a>');});
  var sc=${JSON.stringify(school || null)};
  if(sc){L.circleMarker([sc.la,sc.lo],{radius:9,color:'#b9552f',weight:3,fillColor:'#fff',fillOpacity:1}).addTo(map).bindPopup('<b>'+sc.n+'</b>').bindTooltip(sc.n,{permanent:true,direction:'top',offset:[0,-10],className:'sc-tip'});}
  function fit(list){
    if(list.length===1){map.setView([list[0].la,list[0].lo],15);}
    else{map.fitBounds(L.latLngBounds(list.map(function(p){return [p.la,p.lo]})).pad(0.15));}
  }
  fit(sc?pts.concat([sc]):pts);
  var sels={};LV.forEach(function(l){sels[l]=document.getElementById('ms_'+l);});
  function matchBefore(p,idx){
    for(var i=0;i<idx;i++){var v=sels[LV[i]].value;if(v&&p[LV[i]]!==v)return false;}
    return true;
  }
  function rebuild(){
    var chainOk=true;
    LV.forEach(function(l,i){
      var el=sels[l];
      if(!chainOk){el.innerHTML='<option value="">'+LB[l]+' 전체</option>';el.value='';el.disabled=true;return;}
      var vals=[];
      pts.forEach(function(p){if(matchBefore(p,i)&&p[l]&&vals.indexOf(p[l])<0)vals.push(p[l]);});
      var cur=el.value;
      el.innerHTML='<option value="">'+LB[l]+' 전체</option>'+vals.map(function(v){return '<option'+(v===cur?' selected':'')+'>'+v+'</option>'}).join('');
      if(vals.indexOf(cur)<0)el.value='';
      if(vals.length===0){el.disabled=true;return;}
      el.disabled=false;
      if(el.value==='')chainOk=false;
    });
  }
  function apply(){
    var vis=[];
    pts.forEach(function(p){
      var ok=true;
      for(var i=0;i<LV.length;i++){var v=sels[LV[i]].value;if(v&&p[LV[i]]!==v){ok=false;break;}}
      if(ok){p._m.addTo(map);vis.push(p);}else{map.removeLayer(p._m);}
    });
    fit(vis.length?vis:pts);
  }
  LV.forEach(function(l,idx){
    sels[l].addEventListener('change',function(){
      for(var j=idx+1;j<LV.length;j++)sels[LV[j]].value='';
      rebuild();apply();
    });
  });
  rebuild();
  map.on('click',function(){map.scrollWheelZoom.enable()});
})();
</script>`;
}
// 거리 계산 (하버사인, m)
function distM(a1, o1, a2, o2) {
  const R = 6371000, r = Math.PI / 180;
  const dA = (a2 - a1) * r, dO = (o2 - o1) * r;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const CLASS_ILLUST = ['illust/c05.jpg', 'illust/c10.jpg', 'illust/c12.jpg', 'illust/c13.jpg', 'illust/c15.jpg', 'illust/c03.jpg'];
const PHOTO_CAPS = ['와와 교실 공간 일러스트 (지점별 시설과 배치는 다를 수 있습니다)', '교실 일러스트입니다. 실제 지점의 시설과 배치는 다를 수 있습니다.', '와와 교실 모습을 그린 그림입니다. 지점마다 시설은 조금씩 다릅니다.'];
function classPhoto(depth, key = '') {
  const f = key ? pick(CLASS_ILLUST, key + 'photo') : 'wawa-class.jpg';
  return `<div class="photo"><img loading="lazy" src="${'../'.repeat(depth)}assets/${f}" alt="와와 교실 공간 일러스트" width="900" height="664"></div>`;
}
// 수업 방식 강조 블록 — 큰 글씨 선언 + 원칙 3개 (2026-09-07 지시: 자기주도·개별진도·강의식 없음·학습코칭 강조)
// 같은 문장이 2,300페이지에 반복되면 페이지 간 유사도가 오르므로 슬롯별 변형을 페이지 키 해시로 고른다.
// ⚠ hash()는 33배+문자코드라 4개 중 고르는 번호가 슬롯끼리 묶인다: L1[i]가 나오면 L2[(i+1)%4]·WAY_CARDS[1].d[(i+3)%4]·WAY_CARDS[2].d[i]가 같은 페이지에 나온다.
//   변형 문구를 고칠 때 이 짝끼리, 그리고 copy.js wawaWay 문단과 같은 표현('수업 시간의 대부분은', '직접 푸는 시간')이 겹치지 않게 볼 것.
const WAY_L1 = [
  '강의식 수업이 아닙니다.<br>학생마다 자기 진도로 공부합니다.',
  '칠판 강의가 없습니다.<br>학생은 각자 자기 교재를 풉니다.',
  '모르는 문제는<br>그 시간에 바로 묻습니다.',
  '진도는 학생마다 다르고,<br>선생님은 옆에서 봐 줍니다.',
];
const WAY_L2 = [
  '선생님이 칠판 앞에서 진도를 나가고 학생이 받아 적는 수업은 하지 않습니다. 학생은 <em>자기 교재를 직접 풀고</em> 선생님은 <em>옆에서 봐 줍니다</em>. <em>공부 방법과 습관</em>도 같이 잡아 줍니다.',
  '진단으로 정한 <em>자기 진도</em>를 각자 나가고, 막히는 곳은 선생님이 <em>그 자리에서</em> 설명해 줍니다. 계획 짜기와 오답 정리 같은 <em>공부 습관</em>도 수업 안에서 챙깁니다.',
  '같은 교실에 있어도 학생마다 <em>교재와 단원이 다릅니다</em>. 선생님은 앞에서 설명하는 대신 <em>학생 옆에서</em> 확인하고, <em>공부하는 방법</em>까지 같이 잡아 줍니다.',
  '칠판에 쓰고 받아 적는 시간이 없습니다. 학생은 <em>자기 문제를 풀고</em>, 선생님은 <em>막히는 문제를 그때그때</em> 설명합니다. <em>공부 습관</em>은 매 수업 확인하면서 잡습니다.',
];
const WAY_CARDS = [
  { t: ['개별 진도', '학생마다 다른 진도', '자기 진도 수업', '진단 후 개별 진도'], d: [
    '처음에 진단을 해서 어디서부터 할지 정합니다. 교재, 단원, 주당 횟수가 학생마다 다르고, 학기 중간에 와도 그 자리에서 시작하면 됩니다.',
    '등록하면 먼저 진단부터 합니다. 그 결과로 교재와 시작 단원을 정하기 때문에 학생마다 진도가 다르고, 개강일을 기다릴 필요도 없습니다.',
    '정해진 반 진도가 없습니다. 학생의 현재 위치에서 시작해 자기 속도로 나가고, 주당 횟수와 교재도 상담에서 학생에 맞춰 정합니다.',
    '이전 학년에서 빠진 단원이 있으면 거기서부터 시작하고, 그 단원을 메운 뒤 지금 학년 단원으로 이어서 나갑니다.',
  ] },
  { t: ['칠판·판서 수업 없음', '강의식 수업 없음', '판서 수업 없음', '강의 대신 직접 풀기'], d: [
    '앞에서 설명하고 받아 적는 시간이 없습니다. 학생이 푸는 동안 선생님이 옆에서 보고, 막히면 그 자리에서 설명해 줍니다.',
    '학생이 푸는 동안 선생님은 풀이 과정을 보고, 틀린 이유를 같이 찾습니다. 설명은 그 학생에게 필요한 만큼 합니다.',
    '설명을 들을 때는 아는 것 같다가도 혼자 풀면 막히는 경우가 많습니다. 그래서 설명은 막힌 학생에게 개별로 하고, 나머지 시간은 직접 풀게 합니다.',
    '진도를 일괄로 나가는 강의가 없어서, 이해가 안 된 단원은 확인하고 넘어갑니다. 한 문제를 붙잡고 있으면 선생님이 와서 같이 풉니다.',
  ] },
  { t: ['학습코칭', '공부 방법과 습관', '공부 습관 관리', '코칭이 붙는 수업'], d: [
    '계획 짜기, 오답 정리, 그날 분량 확인까지 선생님이 매 수업 챙기면서, 학생이 스스로 공부하는 습관을 들이게 합니다.',
    '과목 수업에 공부 방법 지도가 같이 붙습니다. 오늘 할 분량을 정하고, 틀린 문제를 정리하고, 다음 수업 전까지 할 일을 확인하는 것을 매번 반복합니다.',
    '계획을 세우고 지키는 것, 오답을 다시 보는 것을 선생님이 매 수업 확인하면서 습관으로 만듭니다.',
    '무엇을 얼마나 할지 학생이 정하고 선생님이 확인합니다. 처음에는 선생님이 잡아 주지만, 학년이 올라갈수록 학생이 스스로 계획하는 쪽으로 넘깁니다.',
  ] },
];
function wayBlock(compact = false, key = 'home') {
  const cards = WAY_CARDS.map((c, i) => `<div class="w"><div class="n">0${i + 1}</div><div class="t">${pick(c.t, key + 'wt' + i)}</div><div class="d">${pick(c.d, key + 'wd' + i)}</div></div>`).join('\n');
  return `<div class="say rv${compact ? ' compact' : ''}">
<div class="k">수업 방식</div>
<div class="l1">${pick(WAY_L1, key + 'l1')}</div>
<div class="l2">${pick(WAY_L2, key + 'l2')}</div>
</div>
<div class="way st">
${cards}
</div>`;
}
const LEVEL_GUIDES = {
  초: ['elem-habit', 'pre-middle', 'study-planner'],
  중: ['exam-4weeks', 'performance-assessment', 'wrong-note'],
  고: ['high1-first-exam', 'performance-assessment', 'high23-balance'],
};

// 지점명이 정확히 일치할 때만 지점 영상 (다른 지점 영상이 섞이면 혼란 — 2026-07-14 지시)
function branchVideo(b) {
  return VIDEOS.branch[b.name] || null;
}
// 초·중·고 안내 블록 기준 = 과목별 수업 학년(grades_by_subject). 학교 목록은 보조.
// (2026-09-08 수정: 학교 목록만 보면 동춘점처럼 고등학교만 등록된 42곳이 고등부만 나왔다)
// 지점 페이지 본문을 h2 단위 섹션(.blk)으로 나눈다. 모바일에서는 openTitles 외 섹션을 접어 두고 제목을 누르면 펼친다(스크립트는 shell에).
const BAND_TITLES = ['지점 안내', '오시는 길', '수업은 이렇게 다릅니다', '와와의 수업 방식', '수업 운영 원칙', '수업 방식', '어떻게 수업하나요', '관리 학교'];
function sectionize(html, closedTitles = []) {
  const parts = html.split(/(?=<h2\b)/);
  return parts.map((p) => {
    const m = p.match(/^<h2([^>]*)>([\s\S]*?)<\/h2>([\s\S]*)$/);
    if (!m) return p;
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    const open = !closedTitles.some((t) => t instanceof RegExp ? t.test(title) : title.startsWith(t));
    const band = BAND_TITLES.some((t) => title.startsWith(t));
    return `<section class="blk${open ? ' blk-open' : ''}${band ? ' band' : ''}"><h2 class="blk-h rv"${m[1]}>${m[2]}</h2><div class="blk-b st">${m[3]}</div></section>`;
  }).join('');
}
function levelsOf(b) {
  const g = new Set();
  for (const v of Object.values(b.grades_by_subject || {})) for (const x of String(v).split(',')) { const c = x.trim()[0]; if (c === '초' || c === '중' || c === '고') g.add(c); }
  const byGrade = ['초', '중', '고'].filter((c) => g.has(c));
  if (byGrade.length) return byGrade;
  const l = [];
  if ((b.schools_elem || []).length) l.push('초');
  if ((b.schools_mid || []).length) l.push('중');
  if ((b.schools_high || []).length) l.push('고');
  return l.length ? l : ['초', '중', '고'];
}
// levels를 주면 그 학교급 학교만 쓴다 (과목 페이지: 그 과목이 개설된 학교급만, 2026-09-17 점검 code#2)
function schoolShort(b, levels, n = 3) {
  const has = (c) => !levels || levels.includes(c);
  const mids = [...(has('중') ? b.schools_mid || [] : []), ...(has('고') ? b.schools_high || [] : [])];
  const arr = mids.length ? mids : (has('초') ? b.schools_elem || [] : []);
  return arr.slice(0, n).join('·') || b.dong + ' 인근 학교';
}
// 설명문용 학교 표기: 중·고 학교 우선 2곳 + '등 N개교'
function schoolBrief(b, n = 2) {
  const all = [...(b.schools_mid || []), ...(b.schools_high || []), ...(b.schools_elem || [])];
  if (!all.length) return '';
  return all.slice(0, n).join('·') + (all.length > n ? ` 등 ${all.length}개교` : '');
}

// ── 홈 ──
// 지점·동네·학교 검색 (홈: 전체, 시도 페이지: prefix로 해당 시도만)
function searchScript(base, prefix) {
  return `<script>
(function(){
  var PREFIX='${prefix}';
  var q=document.getElementById('q'),res=document.getElementById('sres'),idx=null,loading=false,waiters=[];
  if(!q)return;
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  // 인덱스를 받는 중에 들어온 입력도 받은 뒤 검색되게 콜백을 모아 둔다 (2026-09-17 점검 code#10)
  function load(cb){
    if(idx){cb();return;}
    waiters.push(cb);
    if(loading)return;
    loading=true;
    fetch('${base}assets/search-index.json').then(function(r){return r.json()}).then(function(d){idx=d;loading=false;waiters.splice(0).forEach(function(f){f();});}).catch(function(){loading=false;waiters=[];});
  }
  function run(){
    var v=q.value.trim();
    if(!v){res.innerHTML='';res.classList.remove('on');return;}
    if(!idx){load(run);return;}
    var starts=[],inc=[];
    for(var i=0;i<idx.length&&starts.length<10;i++){
      var e=idx[i];
      if(PREFIX&&e.u.indexOf(PREFIX)!==0)continue;
      if(e.n.indexOf(v)===0)starts.push(e);
      else if(inc.length<10&&(e.n.indexOf(v)>-1||e.s.indexOf(v)>-1))inc.push(e);
    }
    var list=starts.concat(inc).slice(0,10);
    res.classList.add('on');
    res.innerHTML=list.length?list.map(function(e){
      return '<a href="'+e.u+'"><span class="tp'+(e.t==='학교'?' school':'')+'">'+e.t+'</span><span class="nm">'+esc(e.n)+'</span><span class="sb">'+esc(e.s)+'</span></a>';
    }).join(''):'<div class="sr-empty">검색 결과가 없습니다. 다른 이름으로 찾아보세요.</div>';
  }
  q.addEventListener('input',run);
  q.addEventListener('focus',function(){load(function(){})});
  document.addEventListener('click',function(e){if(!res.contains(e.target)&&e.target!==q){res.classList.remove('on');}});
})();
</script>`;
}
function buildHome() {
  const total = Object.keys(BRANCHES).length;
  // 시도 타일 지도 (열, 행) — 대략적 한반도 배치
  const regionInfo = {};
  for (const r of Object.values(regions)) regionInfo[r.name] = { slug: r.slug, n: Object.values(r.districts).reduce((s, d) => s + d.branches.length, 0) };
  const KMAP = [
    ['서울', 2, 1], ['경기', 3, 1], ['강원', 4, 1],
    ['인천', 1, 2], ['세종', 2, 2], ['충북', 3, 2], ['경북', 4, 2],
    ['충남', 1, 3], ['대전', 2, 3], ['대구', 3, 3], ['울산', 4, 3],
    ['전북', 1, 4], ['광주', 2, 4], ['경남', 3, 4], ['부산', 4, 4],
    ['전남', 2, 5], ['제주', 1, 5],
  ];
  const kmapHtml = KMAP.map(([name, c, r]) => {
    const info = regionInfo[name];
    const pos = `style="grid-column:${c};grid-row:${r}"`;
    if (!info) return `<span class="off" ${pos}>${name}<span>준비 중</span></span>`;
    const lv = info.n > 20 ? ' class="lv3"' : info.n > 5 ? ' class="lv2"' : '';
    return `<a href="./${info.slug}/"${lv} ${pos}>${name}<span class="cnt2">${info.n}곳</span></a>`;
  }).join('');
  const totalSchools = Object.keys(schools).length.toLocaleString();
  const WORRIES = [
    { q: '학원을 다니는데 성적이 그대로예요', a: '학생 수준과 진도가 맞지 않으면 수업을 들어도 남는 것이 적습니다. 와와는 칠판 강의 없이 진단으로 시작점을 찾고, 학생마다 교재와 단원을 다르게 잡는 개별 진도로 수업합니다.' },
    { q: '혼자서는 책상에 앉지를 않아요', a: '혼자 계획을 세우고 지키기는 쉽지 않습니다. 와와는 수업마다 계획을 확인하고 테스트를 봐서, 정해진 분량을 끝내는 습관을 학원에서 같이 만듭니다.' },
    { q: '우리 학교 시험 스타일을 아는 곳이 없어요', a: '지점마다 인근 학교 재학생이 다녀서 학교별 진도, 필기, 기출 정보를 학기마다 정리합니다. 중·고등부는 시험 3~4주 전부터 그 자료로 대비합니다.' },
    { q: '수행평가까지 챙겨 주는 곳이 필요해요', a: '학기 초 평가 계획을 확인해 두고, 제출 일정은 마감 전까지 학원 일정에서 같이 챙깁니다. 학기 성적은 지필과 수행평가를 합쳐서 나옵니다.' },
  ];
  const STEPS = [
    ['진단 상담', '학교, 학년, 현재 성적을 보고 어느 단원부터 시작할지 정합니다.'],
    ['개별 진도 수업', '칠판 강의 없이 학생이 자기 교재를 풉니다. 교재와 단원이 학생마다 다르고, 막히면 선생님이 옆에서 설명해 줍니다.'],
    ['숙제·코칭 사이클', '배운 것을 집에서 풀고 다음 수업에서 확인합니다. 계획 짜기, 오답 정리, 그날 분량 확인도 이때 같이 합니다.'],
    ['학교별 내신 대비', '시험 3~4주 전부터 다니는 학교의 자료 기준으로 수업이 바뀝니다.'],
  ];
  const SUBJ_HOME = [
    ['국어', '교과서 지문과 학교 필기 기준으로 내신을 준비합니다.', 'korean-textbook'],
    ['영어', '단어, 문법, 서술형을 학교 시험 스타일에 맞춥니다.', 'english-grammar'],
    ['수학', '진단으로 구멍부터 메우고, 학교 기출로 마무리합니다.', 'math-wrong'],
    ['사회', '단원의 흐름을 먼저 잡아 암기량을 줄입니다.', 'social-structure'],
    ['과학', '개념을 설명할 수 있을 때까지 확인하고 넘어갑니다.', 'science-explain'],
  ];
  const HOME_FAQ = [
    { q: '상담은 어떻게 신청하나요?', a: '화면의 전화 상담 버튼을 누르시거나, 상담 신청 페이지에 학생의 학교와 학년, 희망 과목을 남겨 주시면 해당 지점에서 연락드립니다.' },
    { q: '수업료는 어떻게 되나요?', a: '학년과 주당 횟수에 따라 다릅니다. 각 지점 페이지의 수강료 안내에서 월 교습비 기준표와 학원 등록번호, 교습비 공시 자료를 확인할 수 있고, 수업 시간과 횟수는 상담에서 조율합니다.' },
    { q: '우리 동네에도 지점이 있나요?', a: `전국에 ${total}개 지점이 있습니다. 지역별 지점 찾기에서 시·군·구를 선택하면 지점 위치와 관리 학교를 확인할 수 있습니다.` },
    { q: '다른 학원과 무엇이 다른가요?', a: '칠판·판서 강의가 없습니다. 진단 후 학생마다 교재와 단원을 다르게 잡는 개별 진도로 각자 공부하고, 과목 선생님이 옆에서 확인하며 공부 방법과 습관까지 코칭합니다. 시험 기간에는 학생이 다니는 학교의 기출과 수업 자료 기준으로 내신을 준비합니다.' },
    { q: '강의를 안 하면 학생이 혼자 공부하는 건가요?', a: '아닙니다. 과목 선생님이 소수 인원을 개별로 봐 주면서 막히는 부분을 바로 설명합니다. 계획 짜기, 오답 정리, 그날 분량 확인도 선생님이 챙기기 때문에 혼자 두는 자습과는 다릅니다.' },
    { q: '몇 학년부터 다닐 수 있나요?', a: '지점에 따라 초등 저학년부터 고3까지 받습니다. 각 지점 페이지의 과목별 대상 학년 표에서 확인할 수 있습니다.' },
  ];
  const faqLd = { '@type': 'FAQPage', mainEntity: HOME_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  // 수상 표기(copy#18): 정식 명칭은 '2025 소비자가 뽑은 올해의 브랜드대상', 교육 부문(국회 교육위원회 위원장상), 수상은 와와학습코칭센터 브랜드,
  // 주최 (사)한국방송신문연합회, 시상식 2025-11-26. 출처는 메트로신문 2025-11-27 기사(metroseoul.co.kr/article/20251127500865) 기준. 근거 없이 바꾸지 말 것.
  const body = `
<div class="hero w"><div class="in">
<div class="award">2025 소비자가 뽑은 올해의 브랜드대상 교육 부문 수상 (와와학습코칭센터 · 주최 한국방송신문연합회)</div>
<h1>칠판 강의 없이<br><em>자기 진도로 공부하는</em> 학원</h1>
<p>${BRAND}은 전국 ${total}개 지점이 있는 초·중·고 교과 학원입니다. 학생마다 자기 진도로 공부하고 선생님이 옆에서 봐 줍니다. 공부 방법과 습관도 같이 잡고, 시험 기간에는 학교 자료로 내신을 준비합니다.</p>
<div class="btns"><a class="b1" href="./inquiry/">상담 신청</a><a class="b2" href="#regions">가까운 지점 찾기</a></div>
<div class="stats"><div class="s"><div class="n">${total}</div><div class="k">전국 지점</div></div><div class="s"><div class="n">${totalSchools}</div><div class="k">관리 학교</div></div><div class="s"><div class="n">5과목</div><div class="k">국·영·수·사·과</div></div></div>
</div></div>

<section class="w-sec"><div class="in">
<div class="w-head rv"><div class="k">Why</div><h2>이런 고민으로<br>오시는 분들이 많습니다</h2><p>상담에서 자주 듣는 이야기들입니다.</p></div>
<div class="w-rows st">${WORRIES.map((w) => `<div class="rv"><b>${esc(w.q)}</b><p>${esc(w.a)}</p></div>`).join('')}</div>
</div></section>

<section class="w-sec dark"><div class="in">
${wayBlock().replace('class="say"','class="say rv"').replace('class="way"','class="way st"')}
</div></section>

<section class="w-sec"><div class="in">
<div class="w-head rv"><div class="k">How</div><h2>수업은 이렇게 진행됩니다</h2><p>${total}개 지점이 같은 방식으로 운영됩니다.</p></div>
<div class="w-line st">${STEPS.map((s, i) => `<div><em>0${i + 1}</em><div><b>${esc(s[0])}</b><p>${esc(s[1])}</p></div></div>`).join('')}</div>
<article class="body" style="margin-top:40px">
<p>지점마다 인근 학교 재학생들이 다녀서 학교별 진도와 시험 정보를 학기마다 정리하고, 시험 기간에는 그 자료로 수업합니다. 평소 수업은 진단, 개별 진도, 매주 확인으로 이어집니다. 강의를 듣는 시간보다 직접 푸는 시간이 길고, 공부 방법과 습관은 선생님이 옆에서 잡아 줍니다.</p>
</article>
<div class="w-photo rv" style="margin-top:36px">${classPhoto(0)}</div>
</div></section>

<section class="w-sec soft"><div class="in">
<div class="w-head rv"><div class="k">Subject</div><h2>과목별 수업</h2><p>다섯 과목 모두 학교 진도 동기화가 원칙입니다. 과목을 누르면 수업 방식을 자세히 볼 수 있습니다.</p></div>
<div class="w-rows st">${SUBJ_HOME.map(([n, d, g]) => `<a href="./guide/${g}/"><b>${n}학원 수업</b><p>${esc(d)}</p></a>`).join('')}</div>
<div class="w-head rv" style="margin-top:72px"><div class="k">Grade</div><h2>학년별 안내</h2></div>
<div class="w-rows st">
<a href="./guide/elem-habit/"><b>초등부</b><p>진도 경쟁보다 습관과 기본기입니다. 매 수업 정해진 분량을 스스로 끝내는 연습과 연산·어휘 점검으로 중학교를 준비합니다. <span class="more">초등 고학년, 성적보다 습관 →</span></p></a>
<a href="./guide/exam-4weeks/"><b>중등부</b><p>지필고사와 수행평가가 성적을 만드는 시기입니다. 시험 4주 전 대비 일정과 수행 제출 관리까지 학원이 챙깁니다. <span class="more">내신 4주 대비 플랜 →</span></p></a>
<a href="./guide/performance-assessment/"><b>고등부</b><p>내신 지필과 수행평가를 같이 준비합니다. 수행 일정은 학기 초 평가 계획으로 미리 잡아 둡니다. <span class="more">수행평가 관리, 점수 새는 곳 막기 →</span></p></a>
</div>
</div></section>

<section class="w-sec"><div class="in">
<div class="w-head rv"><div class="k">Review</div><h2>다녀 본 학생과<br>학부모의 이야기</h2></div>
<div class="w-quote st">${REVIEWS.slice(0, 3).map((r) => `<div class="rv"><p>${esc(r.text.length > 100 ? r.text.slice(0, 100) + '…' : r.text)}</p><div class="who">${esc(r.author)} · ${esc(r.meta)} · ${esc(r.subject)}</div></div>`).join('')}</div>
<div class="more-link rv"><a href="./review/">수강후기 전체 보기 →</a></div>
</div></section>

<section class="w-sec soft" id="regions"><div class="in">
<div class="w-head rv"><div class="k">Where</div><h2>지역별 지점 찾기</h2><p>지점명, 동네, 학교 이름으로 검색하거나 지도에서 지역을 선택하세요.</p></div>
<div class="sbox"><input id="q" type="search" placeholder="지점·동네·학교 검색 (예: 산본점, 덕풍동, 산본중)" autocomplete="off" aria-label="지점 검색"><div id="sres" class="sres"></div></div>
<div class="kmap st">${kmapHtml}</div>
</div></section>

<section class="w-sec"><div class="in">
${video(VIDEOS.pools.brand[0], '와와 소개 영상')}
<div class="w-head rv" style="margin-top:72px"><div class="k">FAQ</div><h2>자주 묻는 질문</h2></div>
<div class="faq st">${HOME_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
</div></section>

<section class="w-cta"><div class="in"><h2 class="rv">학생의 학교와 학년만 알려 주시면<br>어느 단원부터 시작할지 답해 드립니다</h2><p class="rv">가까운 지점에서 진단 상담 일정을 잡아 연락드립니다. 전화나 상담 신청 어느 쪽이든 괜찮습니다.</p><div class="btns rv"><a class="b1" href="./inquiry/">상담 신청</a><a class="b2" href="tel:${TEL}">전화 상담</a></div></div></section>
${searchScript('./', '')}`;
  write('index.html', shell({
    title: `${BRAND} | 전국 ${total}개 지점, 학교별 내신 전문 초중고 학원`,
    desc: fitDesc(
      `전국 ${total}개 지점의 초·중·고 교과 학원. 진단 후 학생마다 자기 진도로 공부하고, 다니는 학교 진도와 기출 기준으로 내신을 준비합니다.`,
      `전국 ${total}개 지점의 초·중·고 교과 학원. 학생마다 자기 진도로 공부하고, 학교 진도와 기출 기준으로 내신을 준비합니다.`,
    ),
    canonical: DOMAIN + '/', body, depth: 0,
    ld: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'EducationalOrganization', name: BRAND, url: DOMAIN, telephone: TEL, description: '초중고 교과 수업과 학교별 내신 관리 전문 학원. 전국 지점 운영.', sameAs: ['https://www.youtube.com/@wawacoachingcenter'], award: '2025 소비자가 뽑은 올해의 브랜드대상 교육 부문 (주최 한국방송신문연합회, 와와학습코칭센터 수상)' },
        faqLd,
      ],
    },
  }));
}

// ── 지역 허브 ──
function buildRegion(r) {
  const dists = Object.values(r.districts).sort((a, b) => b.branches.length - a.branches.length);
  const cards = dists.map((d) => `<a href="./${d.slug}/">${esc(d.name)}<span class="cnt">지점 ${d.branches.length}곳 · ${d.branches.map((b) => b.name).slice(0, 3).join(', ')}${d.branches.length > 3 ? ' 외' : ''}</span></a>`).join('');
  const n = dists.reduce((s, d) => s + d.branches.length, 0);
  const tiles = dists.map((d) => { const k = d.branches.length; const lv = k > 12 ? ' class="lv3"' : k > 5 ? ' class="lv2"' : ''; return `<a href="./${d.slug}/"${lv}>${esc(d.name)}<span class="cnt2">${k}곳</span></a>`; }).join('');
  const pts = [];
  for (const d of Object.values(r.districts)) for (const b of d.branches) {
    pts.push({ n: b.name, city: d.name, gu: guOf(b) || '', dong: b.dong || '', la: b.lat, lo: b.lng, u: `/${r.slug}/${d.slug}/${b.branch_slug}/` });
  }
  const body = `<div class="wrap">
${crumb(1, [{ name: r.name }])}
<div class="page-head"><span class="tag">지역 안내</span><h1>${esc(r.name)} ${BRAND} 지점</h1><div class="sub">${esc(r.name)}에는 ${n}개 지점이 있습니다. 검색하거나 시·군·구를 선택하면 지점별 과목과 관리 학교를 볼 수 있습니다.</div></div>
<article class="body">
<h2 id="regions">${esc(r.name)} 지역별 지점 찾기</h2>
<p class="sec-sub">지점명, 동네, 학교 이름으로 검색하거나 시·군·구를 선택하세요.</p>
<div class="sbox"><input id="q" type="search" placeholder="${esc(r.name)} 지점·동네·학교 검색" autocomplete="off" aria-label="지점 검색"><div id="sres" class="sres"></div></div>
<div class="dmap st">${tiles}</div>
<h2>시·군·구별 지점</h2><div class="list-grid st">${cards}</div></article>
${ctaBand(null, 1)}</div>
${searchScript('../', '/' + r.slug + '/')}`;
  write(`${r.slug}/index.html`, shell({
    title: `${r.name} 초중고 학원 | ${BRAND} ${n}개 지점`,
    desc: `${r.name}의 ${BRAND} ${n}개 지점 안내. 시·군·구별 지점 위치, 수업 과목, 관리 학교 목록.`,
    canonical: `${DOMAIN}/${r.slug}/`, body, depth: 1,
  }));
}

// ── 시군구 허브 ──
function buildDistrict(r, d) {
  const bCards = d.branches.map((b) => {
    const subj = (b.subjects || []).join('·');
    return `<a href="./${b.branch_slug}/">${esc(b.name)}<span class="cnt">${esc(b.dong)} · ${esc(subj)}</span></a>`;
  }).join('');
  const schoolsHere = Object.values(schools).filter((s) => s.region_slug === r.slug && s.district_slug === d.slug);
  const byLevel = { 초: [], 중: [], 고: [] };
  schoolsHere.forEach((s) => byLevel[s.level].push(s));
  let schoolHtml = '';
  for (const [lv, arr] of Object.entries(byLevel)) {
    if (!arr.length) continue;
    schoolHtml += `<h3>${lv === '초' ? '초등학교' : lv === '중' ? '중학교' : '고등학교'}</h3><div class="chips st">${arr.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => `<a href="./school/${encodeURIComponent(s.name)}/">${esc(s.name)}</a>`).join('')}</div>`;
  }
  const body = `<div class="wrap">
${crumb(2, [{ name: r.name, slug: r.slug }, { name: d.name }])}
<div class="page-head"><span class="tag">${esc(r.name)}</span><h1>${esc(d.name)} 초중고 학원, ${BRAND}</h1><div class="sub">${esc(d.name)} ${d.branches.length}개 지점에 인근 ${schoolsHere.length}개 학교 학생들이 다니고 있습니다.</div></div>
<article class="body">
${(() => {
  const dpts = d.branches.map((b) => ({ n: b.name, gu: guOf(b) || '', dong: b.dong || '', la: b.lat, lo: b.lng, u: `/${r.slug}/${d.slug}/${b.branch_slug}/` }));
  const gus = new Set(dpts.map((p) => p.gu).filter(Boolean));
  const dongs = new Set(dpts.map((p) => p.dong).filter(Boolean));
  const lv = gus.size >= 2 ? ['gu', 'dong'] : (dongs.size >= 3 ? ['dong'] : []);
  return branchesMap(dpts, lv);
})()}
<h2>${esc(d.name)} 지점</h2><div class="list-grid">${bCards}</div>
<h2>관리 학교별 안내</h2>
<p>학교 이름을 선택하면 그 학교 학생을 위한 수업 안내 페이지로 이동합니다. 목록에 없는 인근 학교 학생도 수업이 가능합니다.</p>
${schoolHtml}
</article>
${ctaBand(null, 2)}</div>`;
  write(`${r.slug}/${d.slug}/index.html`, shell({
    title: `${rdName(r.name, d.name)} 초중고 학원 | ${BRAND} 지점 ${d.branches.length}곳`,
    desc: (() => {
      const rd = rdName(r.name, d.name);
      const bn = d.branches.map((b) => b.name);
      const names = (k) => bn.slice(0, k).join(', ') + (bn.length > k ? ` 외 ${bn.length - k}곳` : '');
      return fitDesc(
        `${rd}의 ${BRAND} 지점 안내. ${names(3)}. 관리 학교 ${schoolsHere.length}곳의 내신 대비.`,
        `${rd}의 ${BRAND} 지점 안내. ${names(2)}. 관리 학교 ${schoolsHere.length}곳의 내신 대비.`,
        `${rd}의 ${BRAND} 지점 ${bn.length}곳 안내. 지점 위치와 관리 학교 ${schoolsHere.length}곳의 내신 대비.`,
      );
    })(),
    canonical: `${DOMAIN}/${r.slug}/${d.slug}/`, body, depth: 2,
  }));
}

// ── 지점 페이지 ──
function buildBranch(r, d, b) {
  const key = b.branch_slug;
  const lede = pick(COPY.ledeBranch, key)(b);
  const bv = branchVideo(b);
  const subjectLinks = (b.subjects || []).map((s) => `<a href="./${SUBJ_SLUG[s]}/">${esc(b.dong)} ${esc(s)}학원</a>`).join('');
  const allSchools = [
    ...(b.schools_elem || []).map((s) => [s, '초등']),
    ...(b.schools_mid || []).map((s) => [s, '중등']),
    ...(b.schools_high || []).map((s) => [s, '고등']),
  ];
  const schoolChips = allSchools.map(([s]) => `<a href="../school/${encodeURIComponent(s)}/">${esc(s)}</a>`).join('');
  const subjPills = (b.subjects || []).map((sj) => { const g = (b.grades_by_subject || {})[sj]; return `<span class="sp">${esc(sj)}${g ? `<em>${esc(gradeRange(g))}</em>` : ''}</span>`; }).join('');
  const faq = faqHtml([COPY.faqPool.common[3], COPY.faqPool.common[0], COPY.faqPool.common[1], COPY.faqPool.common[2]], { tel: TEL, branchName: b.name });
  const levels = levelsOf(b);
  const gradeBlocks = levels.map((lv) => pick(COPY.gradeBlock[lv], key + lv)()).join('');
  const body = `<div class="wrap">
${crumb(3, [{ name: r.name, slug: r.slug }, { name: d.name, slug: d.slug }, { name: b.name }])}
<div class="bh"><div class="page-head"><span class="tag">${esc(d.name)} ${esc(b.dong)}</span>${specBadge(b.name)}<h1>${BRAND} ${esc(b.name)}</h1><div class="sub">${esc(lede)}</div></div>
${classPhoto(3, b.branch_slug)}</div>
<article class="body">
${sectionize(`<h2>지점 안내</h2>
<div class="tbl-scroll"><table class="info-table">
<tr><th>주소</th><td>${esc(b.address)}${b.location_guide ? `<br><span style="color:var(--ink-soft);font-size:13.5px">${esc(b.location_guide).replace(/\n/g, '<br>')}</span>` : ''}</td></tr>
${nearbyRow(b)}
<tr><th>수업 과목</th><td><div class="sp-row">${subjPills}</div></td></tr>
<tr><th>수업 시간</th><td>${esc(hoursTxt(b))}<br><span class="td-sub">${pick(['상담 예약제 · 셔틀버스 없음 · 수업비는 아래 <a href="#fee">수강료 안내</a> 참고', '방문 상담은 예약 후 · 셔틀 운행 없음 · 수업비는 <a href="#fee">수강료 안내</a>에서 확인', '상담은 미리 예약 · 셔틀버스 운영 안 함 · 금액은 아래 <a href="#fee">수강료 표</a> 참고'], key + 'ops')}</span></td></tr>
</table></div>
${osmMap(b)}`, [])}
${wayBlock(false, b.branch_slug)}
${bv ? video(bv, `${BRAND} ${b.name} 영상`) : video(pick(VIDEOS.pools.brand, b.branch_slug + 'promo'), pick(VIDEO_CAPS, b.branch_slug + 'vcap'))}
${sectionize(`${pick(COPY.wawaWay, b.branch_slug + 'way')(b.subjects)}
${gradeBlocks}
<h2>과목별 수업 안내</h2>
<p>${pick([`과목을 선택하면 ${esc(b.dong)} 기준의 수업 방식과 내신 대비 흐름을 자세히 볼 수 있습니다.`, `${esc(b.dong)}에서 듣는 과목별 수업 내용과 시험 대비 방식은 과목 이름을 누르면 볼 수 있습니다.`, `아래 과목을 누르면 ${esc(b.name)}의 과목별 수업 순서와 내신 준비 방법을 확인할 수 있습니다.`], key + 'subp')}</p>
<div class="chips st">${subjectLinks}</div>
<h2>관리 학교</h2>
<p>${pick([`${esc(b.name)}에 다니는 학생들의 소속 학교입니다. 학교별 수업 안내는 학교 이름을 눌러 확인하세요. <strong>목록에 없는 인근 학교 학생도 수업이 가능하니</strong> 상담에서 확인해 주세요.`, `${esc(b.name)} 학생들이 다니는 학교입니다. 학교 이름을 누르면 그 학교 기준의 수업 안내가 나옵니다. <strong>목록에 없는 학교도 인근이면 수업할 수 있으니</strong> 상담 때 말씀해 주세요.`, `현재 ${esc(b.name)}에 다니는 학생들의 학교 목록입니다. 학교별 수업 안내는 이름을 눌러 보세요. <strong>여기 없는 학교 학생도 상담 후 수업이 가능합니다.</strong>`], key + 'schp')}</p>
<div class="chips st">${schoolChips}</div>
${faq.html}`, ['수업은 이렇게 다릅니다', '와와의 수업 방식', '수업 운영 원칙', '수업 방식', '어떻게 수업하나요', '자주 묻는 질문', /학생|내신|재학생|공부 습관/])}
</article>
${ctaBand(b, 3)}
<article class="body">${sectionize(feeSection(b), [])}</article></div>`;
  write(`${r.slug}/${d.slug}/${b.branch_slug}/index.html`, shell({
    branch: b.name,
    title: `${BRAND} ${b.name} | ${b.dong} 초중고 학원`,
    // 설명문은 80자 안에서: 수업 시간은 빼고(문장으로 읽히지 않았다) 학교는 2곳 + '등 N개교' (2026-09-17 점검 code#8)
    desc: (() => {
      const subj = (b.subjects || []).join('·');
      const hasMidHigh = (b.schools_mid || []).length + (b.schools_high || []).length > 0;
      const tail = hasMidHigh ? '내신 관리' : '학생 수업';
      const sb1 = schoolBrief(b, 2), sb0 = schoolBrief(b, 1);
      return fitDesc(
        sb1 && `${rdName(b.region, b.district)} ${b.dong}의 ${BRAND} ${b.name}. ${subj} 수업, ${sb1} ${tail}.`,
        sb1 && `${b.district} ${b.dong}의 ${BRAND} ${b.name}. ${subj} 수업, ${sb1} ${tail}.`,
        sb0 && `${b.district} ${b.dong}의 ${BRAND} ${b.name}. ${subj} 수업, ${sb0} ${tail}.`,
        `${b.district} ${b.dong}의 ${BRAND} ${b.name}. ${subj} 수업과 학교별 ${hasMidHigh ? '내신 관리' : '교과 수업'}.`,
      );
    })(),
    canonical: `${DOMAIN}/${r.slug}/${d.slug}/${b.branch_slug}/`, body, depth: 3,
    footExtra: b.reg ? `${esc(b.office || BRAND + ' ' + b.name)} · 등록번호 ${esc(b.reg)}` : '',
    ld: {
      '@context': 'https://schema.org', '@type': 'LocalBusiness', name: `${BRAND} ${b.name}`,
      address: b.address, telephone: TEL, url: `${DOMAIN}/${r.slug}/${d.slug}/${b.branch_slug}/`,
      ...(b.lat ? { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } } : {}),
    },
  }));
}

// ── 동+과목 키워드 페이지 ──
// 초등 학년만 개설된 과목 페이지용 문구 (지족점 국어 등 6쪽). 과목 공통 문구는 중·고 내신·기출을 전제로 해서 초등만 받는 과목에는 맞지 않는다.
const ELEM_SUBJ_LEDE = [
  (c) => `${c.branchName}의 ${c.subject} 수업은 초등 학년을 대상으로 합니다. ${c.schoolShort} 학생들의 교과 진도에 맞춰 수업하고, 매 수업 정해진 분량을 스스로 끝내는 습관을 같이 잡습니다.`,
  (c) => `${c.dong}의 ${c.branchName}은 초등 ${c.subject} 수업을 학교 교과 진도에 맞춰 진행합니다. 등록할 때 진단으로 빈 단원을 찾고, 거기서부터 자기 진도로 시작합니다.`,
];
const ELEM_SUBJ_METHOD = [
  () => `<p>수업은 학교 교과서 단원 순서를 따라갑니다. 그날 배운 내용은 문제로 확인하고, 틀린 문제는 다음 수업 시작 때 다시 풀어 봅니다.</p><p>단원평가가 있는 주에는 그 단원을 한 번 더 점검합니다. 이전 학년에서 빈 단원이 보이면 그 단원으로 돌아가 메우고 진도를 이어 갑니다.</p>`,
  () => `<p>초등 과정에서는 진도를 빨리 나가는 것보다 배운 단원을 제대로 끝내는 쪽에 시간을 씁니다. 교과서 흐름에 맞춰 개념을 확인하고, 학생이 직접 풀고 설명해 보게 한 뒤 다음 단원으로 넘어갑니다.</p><p>하루 분량과 숙제는 학교 생활에 맞춰 조절하고, 진도와 빈 단원은 상담 때 학부모님과 같이 확인합니다.</p>`,
];
function buildSubject(r, d, b, subj) {
  const slug = SUBJ_SLUG[subj];
  const key = `${b.branch_slug}/${slug}`;
  // 학년 블록·학교 표기는 지점 전체가 아니라 이 과목이 개설된 학교급 기준 (하계점 국어 중3~고3 페이지에 초등부 블록이 나오던 문제, 2026-09-17 점검 code#2)
  const levels = subjLevels(b, subj) || levelsOf(b);
  const elemOnly = levels.length === 1 && levels[0] === '초';
  const ctx = { dong: b.dong, district: d.name, branchName: b.name, schoolShort: schoolShort(b, levels), subject: subj };
  const lede = pick(elemOnly ? ELEM_SUBJ_LEDE : COPY.ledeSubject[subj], key)(ctx);
  const methodHtml = pick(elemOnly ? ELEM_SUBJ_METHOD : COPY.method[subj], key + 'm')(ctx);
  const gradeBlocks = levels.map((lv) => pick(COPY.gradeBlock[lv], key + lv)()).join('');
  const grades = (b.grades_by_subject || {})[subj];
  const bv = branchVideo(b); // 지점 매칭 영상이 있을 때만 노출
  const faq = faqHtml([elemOnly ? COPY.faqPool.elem[0] : COPY.faqPool.subject[0], COPY.faqPool.subject[1], COPY.faqPool.common[3], COPY.faqPool.common[1]], { tel: TEL, branchName: b.name, schoolShort: ctx.schoolShort, subject: subj });
  const otherSubjects = (b.subjects || []).filter((s) => s !== subj).map((s) => `<a href="../${SUBJ_SLUG[s]}/">${esc(b.dong)} ${esc(s)}학원</a>`).join('');
  const body = `<div class="wrap">
${crumb(4, [{ name: r.name, slug: r.slug }, { name: d.name, slug: d.slug }, { name: b.name, slug: b.branch_slug }, { name: `${b.dong} ${subj}학원` }])}
<div class="page-head"><span class="tag">${esc(d.name)} ${esc(b.dong)}</span>${specBadge(b.name)}<h1>${esc(b.dong)} ${esc(subj)}학원 · ${esc(b.name)}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
<h2>${esc(subj)} 수업은 이렇게 진행합니다</h2>
${methodHtml}
${grades ? `<div class="note">${esc(b.name)} ${esc(subj)} 수업 대상: ${esc(gradeRange(grades))}</div>` : ''}
${wayBlock(true, key)}
${gradeBlocks}
${bv ? video(bv, `${BRAND} ${b.name} 영상`) : ''}
<h2>지점 정보</h2>
<div class="tbl-scroll"><table class="info-table">
<tr><th>지점</th><td><a href="../" style="color:var(--brick);font-weight:600">${BRAND} ${esc(b.name)}</a></td></tr>
<tr><th>주소</th><td>${esc(b.address)}</td></tr>
<tr><th>수업 시간</th><td>${esc(hoursTxt(b))}</td></tr>
</table></div>
${otherSubjects ? `<h2>${esc(b.dong)}의 다른 과목 수업</h2><div class="chips st">${otherSubjects}</div>` : ''}
${guideLinks(SUBJ_GUIDES[subj], 4, subj + ' 공부법 칼럼')}
${faq.html}
</article>
${ctaBand(b, 4)}
<article class="body">${feeSection(b)}</article></div>`;
  write(`${r.slug}/${d.slug}/${b.branch_slug}/${slug}/index.html`, shell({
    branch: b.name,
    title: `${b.dong} ${subj}학원 | ${BRAND} ${b.name}`,
    desc: elemOnly
      ? fitDesc(`${b.district} ${b.dong} 초등 ${subj} 수업 안내. ${BRAND} ${b.name}에서 학교 교과 진도에 맞춰 수업하고 공부 습관을 잡습니다.`, `${b.dong} 초등 ${subj} 수업 안내. ${BRAND} ${b.name}에서 학교 교과 진도에 맞춰 수업합니다.`)
      : fitDesc(
        `${b.district} ${b.dong} ${subj}학원 안내. ${BRAND} ${b.name}의 ${subj} 수업 방식과 학년별 커리큘럼, ${ctx.schoolShort} 내신 대비.`,
        `${b.district} ${b.dong} ${subj}학원 안내. ${BRAND} ${b.name}의 ${subj} 수업 방식과 학년별 커리큘럼, ${schoolShort(b, levels, 2)} 내신 대비.`,
        `${b.dong} ${subj}학원 안내. ${BRAND} ${b.name}의 ${subj} 수업 방식과 학년별 커리큘럼, ${schoolShort(b, levels, 1)} 내신 대비.`,
        `${b.dong} ${subj}학원 안내. ${BRAND} ${b.name}의 ${subj} 수업 방식과 학년별 커리큘럼, 학교별 내신 대비.`,
      ),
    canonical: `${DOMAIN}/${r.slug}/${d.slug}/${b.branch_slug}/${slug}/`, body, depth: 4,
    ld: faq.ld,
    footExtra: b.reg ? `${esc(b.office || BRAND + ' ' + b.name)} · 등록번호 ${esc(b.reg)}` : '',
  }));
}

// ── 학교 페이지 ──
const SCHOOL_NO_SUBJ = []; // 이 학교급에 개설된 과목이 있는 지점이 하나도 없는 학교 (빌드 로그로 확인)
function buildSchool(s) {
  const key = `${s.region_slug}/${s.district_slug}/${s.name}`;
  const b0 = s.branches[0];
  const lede = pick(COPY.schoolLede[s.level], key)(s.name, b0.name, b0.dong);
  const bodyBlock = pick(COPY.schoolBody[s.level], key + 'b')(s.name);
  const bv = branchVideo(b0); // 해당 지점의 매칭 영상이 있을 때만 노출
  // 초등학교는 지필 정기고사·내신 성적이 없어 '내신 학원'·'시험 자료'로 안내하지 않는다 (2026-09-17 점검 copy#7)
  const isElem = s.level === '초';
  const faq = faqHtml(isElem
    ? [COPY.faqPool.elem[0], COPY.faqPool.subject[1], COPY.faqPool.common[0]]
    : [COPY.faqPool.school[0], COPY.faqPool.school[1], COPY.faqPool.common[0]], { tel: TEL, school: s.name });
  // 나이스 학교기본정보·학사일정은 2026-09-08 사용자 지시로 비노출(오류 데이터 많음). data/school-info.json·SCHOOL_CODES는 남겨 두되 렌더링하지 않는다.
  // 학사일정 위젯 (나이스 코드 확보된 학교만 — myschool 워커 API 경유, 24h 캐시)
  // 학교→지점 거리 (지오코딩 성공 + 8km 이내일 때만 — 좌표 오매칭 방지)
  const geo = SCHOOL_GEO[`${s.region}|${s.district}|${s.name}`];
  // 이 학교 학생이 들을 수 있는 과목 = 지점 개설 과목 중 이 학교급(초·중·고) 학년이 열린 과목 (2026-09-17 점검 code#2)
  const subsOf = (b) => (b.subjects || []).filter((sj) => offered(b, sj, s.level));
  const bRows = s.branches.map((b) => {
    let dist = '';
    if (geo && b.lat && b.lng) {
      const m = distM(geo.lat, geo.lng, b.lat, b.lng);
      if (m <= 8000) {
        const dTxt = m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)}m` : `${(m / 1000).toFixed(1)}km`;
        const walk = Math.max(1, Math.round(m / 67));
        dist = `<span style="color:var(--brick);font-weight:600;font-size:13.5px">${esc(s.name)}에서 약 ${dTxt}${m <= 2500 ? ` · 도보 ${walk}분` : ''}</span><br>`;
      }
    }
    return `<tr><th><a href="../../${b.branch_slug}/" style="color:var(--brick);font-weight:600">${esc(b.name)}</a></th><td>${dist}${esc(b.address)}<br><span style="color:var(--ink-soft);font-size:13.5px">${esc([subsOf(b).join(' · ') || '과목은 상담 시 확인', openTimeTxt(b)].filter(Boolean).join(' · '))}</span></td></tr>`;
  }).join('');
  const lvName = s.level === '초' ? '초등학교' : s.level === '중' ? '중학교' : '고등학교';
  const bS = subsOf(b0).length ? b0 : s.branches.find((br) => subsOf(br).length) || null;
  if (!bS) SCHOOL_NO_SUBJ.push(key);
  const body = `<div class="wrap">
${crumb(4, [{ name: s.region, slug: s.region_slug }, { name: s.district, slug: s.district_slug }, { name: s.name + (isElem ? ' 학원' : ' 내신 학원') }])}
<div class="page-head"><span class="tag">${esc(s.district)} · ${lvName}</span><h1>${esc(s.name)} ${isElem ? '학원' : '내신 학원'}, ${BRAND}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
${bodyBlock}
${(() => { const ww = ['국어', '영어', '수학', '사회', '과학'].filter((x) => s.branches.some((br) => subsOf(br).includes(x))); return ww.length ? pick(COPY.wawaWay, key + 'way')(ww) : COPY.wawaWay[2](); })()}
<h2>${esc(s.name)} 학생이 다닐 수 있는 지점</h2>
<div class="tbl-scroll"><table class="info-table">${bRows}</table></div>
${(() => {
  const mpts = s.branches.filter((b) => b.lat && b.lng).map((b) => ({ n: b.name, la: b.lat, lo: b.lng, u: `../../${b.branch_slug}/` }));
  const scOk = geo && s.branches.some((b) => b.lat && b.lng && distM(geo.lat, geo.lng, b.lat, b.lng) <= 8000);
  return branchesMap(mpts, [], scOk ? { n: s.name, la: geo.lat, lo: geo.lng } : null);
})()}
${bS && subsOf(bS).length ? `<h2>${esc(s.name)} 재학생 수업 과목</h2><p>${esc(bS.name)}에서 ${esc(s.name)} 학생이 들을 수 있는 과목은 ${esc(subsOf(bS).join(', '))}입니다. ${s.level === '초' ? '초등부는 교과 진도를 따라가면서 공부 습관과 기본기를 함께 관리합니다.' : s.level === '중' ? '평소에는 학교 진도 기준으로 수업하고, 시험 기간에는 ' + esc(s.name) + ' 범위에 맞춘 내신 대비로 전환됩니다. 수행평가 일정도 수업 계획에 반영합니다.' : '수업은 학교 진도와 동기화되며, 내신 4주 전부터 ' + esc(s.name) + ' 기출 유형 중심의 실전 대비로 바뀝니다. 과목별 수업 방식은 아래에서 확인할 수 있습니다.'}</p><div class="chips st">${subsOf(bS).filter((su) => SUBJ_SLUG[su]).map((su) => `<a href="../../${bS.branch_slug}/${SUBJ_SLUG[su]}/">${esc(bS.dong)} ${esc(su)}학원</a>`).join('')}</div>` : `<h2>${esc(s.name)} 재학생 수업 과목</h2><p>${esc(s.name)} 학생이 들을 수 있는 과목과 학년은 지점마다 달라 상담에서 확인해 드립니다.</p>`}
${wayBlock(true, key)}
${bv ? video(bv, `${BRAND} ${b0.name} 영상`) : video(pick(VIDEOS.pools.brand, key + 'promo'), pick(VIDEO_CAPS, key + 'vcap'))}
${faq.html}
</article>
${ctaBand(b0, 4)}
<article class="body">
${s.level === '고' ? `<div class="note calc-note"><b>${esc(s.name)} 성적표로 등급 계산해 보기</b> 과목별 석차와 수강자 수를 넣으면 5등급(2025년 고1부터)·9등급 기준 석차등급을 계산합니다. <a href="../../../../grade-calculator/">내신 등급 계산기 →</a></div>` : ''}
${guideLinks(LEVEL_GUIDES[s.level], 4)}
${schoolFeeSection(s)}
</article></div>`;
  write(`${s.region_slug}/${s.district_slug}/school/${s.name}/index.html`, shell({
    title: isElem ? `${s.name} 근처 학원 | ${s.district} ${BRAND}` : `${s.name} 내신 학원 | ${s.district} ${BRAND}`,
    desc: (() => {
      const bn = s.branches.map((b) => b.name);
      const all = bn.join(', ');
      const one = bn[0] + (bn.length > 1 ? ` 외 ${bn.length - 1}곳` : '');
      return isElem
        ? fitDesc(
          `${s.name} 학생을 위한 수업 안내. ${s.district} ${BRAND} ${all}에서 ${s.name} 교과 진도에 맞춰 수업하고 공부 습관을 잡습니다.`,
          `${s.name} 학생을 위한 수업 안내. ${s.district} ${BRAND} ${one}에서 교과 진도에 맞춰 수업하고 공부 습관을 잡습니다.`,
          `${s.name} 학생을 위한 수업 안내. ${BRAND} ${one}에서 교과 진도에 맞춰 수업하고 공부 습관을 잡습니다.`,
          `${s.name} 학생 수업 안내. ${BRAND} ${bn[0]}에서 교과 진도에 맞춰 수업합니다.`,
        )
        : fitDesc(
          `${s.name} 재학생을 위한 내신 대비 안내. ${s.district} ${BRAND} ${all}에서 ${s.name} 진도와 기출 기준으로 시험을 준비합니다.`,
          `${s.name} 재학생을 위한 내신 대비 안내. ${s.district} ${BRAND} ${one}에서 학교 진도와 기출 기준으로 시험을 준비합니다.`,
          `${s.name} 재학생을 위한 내신 대비 안내. ${BRAND} ${one}에서 학교 진도와 기출 기준으로 시험을 준비합니다.`,
          `${s.name} 내신 대비 안내. ${BRAND} ${bn[0]}에서 학교 진도와 기출 기준으로 준비합니다.`,
        );
    })(),
    canonical: `${DOMAIN}/${s.region_slug}/${s.district_slug}/school/${encodeURIComponent(s.name)}/`, body, depth: 4,
    ld: faq.ld,
    // 교습비 표가 있는 페이지라 푸터에도 지점별 정식 명칭·등록번호를 한 줄씩 둔다 (지점·과목 페이지와 같은 형식)
    footExtra: s.branches.filter((b) => b.reg).map((b) => `${esc(b.office || BRAND + ' ' + b.name)} · 등록번호 ${esc(b.reg)}`).join('<br>'),
  }));
}

// ── 공부법 칼럼 ──
// '대학 준비와 생기부' 카테고리는 2026-09-17 점검(copy#3)으로 없앴다. 입시 전형·학종 설명 글 2편은 이동 안내 페이지로 내리고(GUIDE_MOVED),
// 세특·수행 글 2편은 수행평가 과제 중심으로 다시 써서 '내신 대비'로 옮겼다. 입시 상담 성격의 칼럼·카테고리를 되살리지 말 것.
const GUIDE_CATS = ['공부 습관', '내신 대비', '과목별 공부법', '학년별 가이드'];
const GUIDE_MOVED = { 'susi-jungsi': 'high23-balance', 'student-record': 'saenggibu-setek' };
// 없앤 칼럼 주소는 404로 두지 않고 noindex + canonical + meta refresh 안내 페이지로 옮길 글에 연결한다 (사이트맵에는 넣지 않는다)
function buildGuideMoved() {
  for (const [from, to] of Object.entries(GUIDE_MOVED)) {
    const url = `${DOMAIN}/guide/${to}/`;
    const p = path.join(ROOT, 'guide', from, 'index.html');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>페이지 이동 안내</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace("${url}");</script>
</head>
<body>
<p>페이지 주소가 변경되었습니다. <a href="${url}">이동하기</a></p>
</body>
</html>
`, 'utf8');
  }
}
function buildGuideIndex() {
  const sections = GUIDE_CATS.map((cat) => {
    const items = GUIDES.filter((g) => g.cat === cat);
    return `<h2>${cat}</h2><div class="list-grid">${items.map((g) => `<a href="./${g.slug}/">${esc(g.title)}<span class="cnt">${esc(g.desc)}</span></a>`).join('')}</div>`;
  }).join('');
  const body = `<div class="wrap">
${crumb(1, [{ name: '공부법 칼럼' }])}
<div class="page-head"><h1>공부법 칼럼</h1><div class="sub">학원에서 학생들을 가르치며 정리한 공부 방법입니다. 학년과 과목에 맞는 글부터 읽어 보세요. 총 ${GUIDES.length}편.</div></div>
<article class="body"><div class="note calc-note"><b>내신 등급 계산기</b> 고등학교 성적표의 과목별 석차와 수강자 수로 석차등급(5등급·9등급)을 계산해 볼 수 있습니다. <a href="../grade-calculator/">계산기 열기 →</a></div>${sections}</article>
${ctaBand(null, 1)}</div>`;
  write('guide/index.html', shell({
    title: `공부법 칼럼 | ${BRAND}`,
    desc: `공부 습관, 내신 대비, 과목별 공부법, 학년별 가이드까지 ${BRAND}이 정리한 공부법 칼럼 ${GUIDES.length}편.`,
    canonical: `${DOMAIN}/guide/`, body, depth: 1,
  }));
}
function buildGuide(g) {
  const related = GUIDES.filter((x) => x.cat === g.cat && x.slug !== g.slug).slice(0, 4);
  const others = GUIDES.filter((x) => x.cat !== g.cat)[hash(g.slug) % Math.max(1, GUIDES.length - 8)];
  const body = `<div class="wrap">
${crumb(2, [{ name: '공부법 칼럼', slug: 'guide' }, { name: g.title }])}
<div class="page-head"><span class="tag">${esc(g.cat)}</span><h1>${esc(g.title)}</h1><div class="sub">${esc(g.desc)}</div></div>
<article class="body">
${g.body}
${g.video ? `<h2>관련 영상</h2>${video(g.video, g.video.title)}` : ''}
<h2>이 카테고리의 다른 글</h2>
<div class="chips st">${related.map((r) => `<a href="../${r.slug}/">${esc(r.title)}</a>`).join('')}${others ? `<a href="../${others.slug}/">${esc(others.title)}</a>` : ''}</div>
</article>
${ctaBand(null, 2)}</div>`;
  write(`guide/${g.slug}/index.html`, shell({
    title: `${g.title} | ${BRAND} 공부법 칼럼`,
    desc: g.desc,
    canonical: `${DOMAIN}/guide/${g.slug}/`, body, depth: 2,
    ld: { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, author: { '@type': 'Organization', name: BRAND }, publisher: { '@type': 'Organization', name: BRAND } },
  }));
}

// ── 수강후기 ──
function buildReview() {
  // 별점 자료가 없어 고정 ★★★★★ 표시는 뺐다 (2026-09-17 점검 copy#5)
  const cards = REVIEWS.map((r) => `<div class="rev"><div class="rtags"><span>${esc(r.gradeLabel)}</span><span>${esc(r.subject)}</span></div><p>${esc(r.text)}</p><div class="who">${esc(r.author)} · ${esc(r.meta)}</div></div>`).join('');
  const body = `<div class="wrap">
${crumb(1, [{ name: '수강후기' }])}
<div class="page-head"><h1>수강후기</h1><div class="sub">와와에 다닌 학생과 학부모님이 남긴 후기입니다. 개인정보 보호를 위해 이름은 일부만 표기합니다.</div></div>
<article class="body">
<div class="rev-grid">${cards}</div>
<div class="note">후기는 학생·학부모가 직접 작성한 내용으로, 학습 결과는 학생의 상황에 따라 다를 수 있습니다.</div>
</article>
${ctaBand(null, 1)}</div>`;
  write('review/index.html', shell({
    title: `수강후기 | ${BRAND}`,
    desc: `${BRAND}에 다닌 학생과 학부모의 수강후기 ${REVIEWS.length}건. 내신 준비, 자기주도학습, 과목 공부 경험담.`,
    canonical: `${DOMAIN}/review/`, body, depth: 1,
  }));
}

// ── 상담 신청 ──
function buildInquiry() {
  const body = `<div class="wrap">
${crumb(1, [{ name: '상담 신청' }])}
<div class="page-head"><h1>상담 신청</h1><div class="sub">상담은 예약제로 진행됩니다. 아래 내용을 남겨 주시면 해당 지점에서 시간을 잡아 연락드립니다. 전화가 편하시면 <a href="tel:${TEL}" style="color:var(--brick);font-weight:700">전화 상담</a>을 눌러 주세요.</div></div>
<div class="form-card">
<form id="f">
<label>지점 선택 <span style="font-weight:400;color:var(--ink-soft)">(모르시면 비워 두셔도 됩니다)</span></label>
<div class="sel-row three">
<select id="fSido"><option value="">시/도</option>${Object.values(regions).map((r) => `<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('')}</select>
<select id="fGu" disabled><option value="">시/군/구</option></select>
<select name="지점" id="fBranch" disabled><option value="">지점</option></select>
</div>
<div class="two"><div><label>학생 이름</label><input name="이름" required placeholder="이름"></div>
<div><label>연락처</label><div style="display:flex;gap:6px"><select name="연락처앞" style="flex:0 0 44px;appearance:none;-webkit-appearance:none;text-align:center;text-align-last:center;padding:0"><option value="010" selected>010</option><option value="011">011</option><option value="016">016</option><option value="017">017</option><option value="018">018</option><option value="019">019</option></select><input name="연락처" required placeholder="1234-5678" inputmode="tel" style="flex:1;min-width:0"></div></div></div>
<label for="fAddr">주소 <span style="font-weight:400;color:var(--ink-soft)">(도로명까지만 적어 주세요)</span></label>
<div class="sel-row" style="align-items:stretch">
<input name="거주주소" id="fAddr" required placeholder="도로명 검색 또는 직접 입력" autocomplete="street-address" maxlength="80" style="flex:1;min-width:0;background:#fff">
<button type="button" id="addrBtn" style="flex:0 0 auto;padding:0 14px;border:1.5px solid var(--brick);border-radius:8px;background:#fff;color:var(--brick);font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap">도로명 검색</button>
</div>
<label for="fLv">학년</label>
<div class="sel-row">
<select name="학년급" id="fLv" required><option value="">선택</option><option>초등</option><option>중등</option><option>고등</option><option>기타</option></select>
<select name="학년상세" id="fGrade" required disabled aria-label="학년 선택"><option value="">-</option></select>
</div>
<label>학교 이름 <span style="font-weight:400;color:var(--ink-soft)">(선택)</span></label><input name="학교" placeholder="예: 덕풍중" maxlength="30">
<label>희망 과목 <span style="font-weight:400;color:var(--ink-soft)">(누르면 선택됩니다)</span></label>
<div class="subj-pills">${['국어', '영어', '수학', '사회', '과학'].map((s) => `<button type="button" class="sp" data-v="${s}">${s}</button>`).join('')}</div>
<div class="agree-box">
<label class="agree" for="fAgree"><input type="checkbox" id="fAgree" checked required onclick="if(!this.checked){alert('체크를 해제하시면 상담 신청이 어렵습니다.');this.checked=true;}"><span>개인정보 수집·이용에 동의합니다 <em>(필수)</em></span></label>
<details class="agree-more"><summary>수집 항목·이용 목적·보유 기간 보기</summary>
<ul>
<li><b>수집 항목</b>필수: 학생 이름, 연락처, 주소, 학년, 희망 과목 · 선택: 지점, 학교 이름 · 신청할 때 함께 저장: 신청 일시, 신청한 페이지와 유입 경로</li>
<li><b>이용 목적</b>상담 연락과 수업·지점 안내</li>
<li><b>처리 방법</b>신청 내용은 운영자가 관리하는 구글 시트에 저장되고, 상담을 맡을 와와 지점에 전달됩니다.</li>
<li><b>제공받는 곳과 제공 항목</b>상담을 맡을 와와 지점(지점마다 따로 등록된 학원)에 학생 이름, 연락처, 주소, 학년, 희망 과목, 학교 이름(적은 경우)을 전달합니다.</li>
<li><b>보유 기간</b>상담 목적을 이루면 지체 없이 파기합니다. 법령에 따라 보관해야 하는 정보는 그 기간 동안만 보관합니다.</li>
<li><b>동의 거부</b>동의를 거부할 수 있습니다. 거부하시면 온라인 상담 신청은 할 수 없고, 전화 상담은 그대로 이용할 수 있습니다.</li>
</ul>
<a href="../privacy/" target="_blank" rel="noopener">개인정보처리방침 전체 보기</a>
</details>
</div>
<button type="submit" class="submit-btn">상담 신청하기</button>
</form>
<div class="form-ok" id="ok"><div class="big">신청이 접수되었습니다</div><p>지점에서 상담 시간을 잡아 연락드리겠습니다.</p></div>
</div></div>
<div id="addrLayer" style="display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.45)">
<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,94vw);background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25)">
<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #eee"><strong style="font-size:15px">도로명 주소 검색</strong><button type="button" id="addrClose" style="border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#666">&times;</button></div>
<div id="addrBox" style="width:100%;height:440px"></div>
</div></div>
<script>
(function(){
  if(new URLSearchParams(location.search).get('embed')==='1'){document.documentElement.classList.add('embed');}
  var DATA=${JSON.stringify(Object.fromEntries(Object.values(regions).map((r) => [r.name, Object.fromEntries(Object.values(r.districts).map((d) => [d.name, d.branches.map((b) => ({ n: b.name, d: b.dong, s: b.subjects, g: Object.fromEntries((b.subjects || []).map((sj) => [sj, (subjLevels(b, sj) || ['초', '중', '고']).join('')])) }))]))])))};
  var sido=document.getElementById('fSido'),gu=document.getElementById('fGu'),sel=document.getElementById('fBranch');
  function fill(s,items,ph){s.innerHTML='<option value=\"\">'+ph+'</option>'+items.join('');s.disabled=false;}
  sido.addEventListener('change',function(){
    gu.innerHTML='<option value=\"\">시/군/구</option>';gu.disabled=true;
    sel.innerHTML='<option value=\"\">지점 선택</option>';sel.disabled=true;
    if(!sido.value)return;
    fill(gu,Object.keys(DATA[sido.value]).map(function(g){return '<option value=\"'+g+'\">'+g+'</option>'}),'시/군/구');
  });
  gu.addEventListener('change',function(){
    sel.innerHTML='<option value=\"\">지점 선택</option>';sel.disabled=true;
    if(!gu.value)return;
    fill(sel,DATA[sido.value][gu.value].map(function(b){return '<option value=\"'+b.n+'\">'+b.n+(b.d?' · '+b.d:'')+'</option>'}),'지점 선택');
  });
  var p=new URLSearchParams(location.search).get('지점');
  if(p){
    outer:for(var rn in DATA){for(var gn in DATA[rn]){for(var i=0;i<DATA[rn][gn].length;i++){
      if(DATA[rn][gn][i].n===p){
        sido.value=rn;sido.dispatchEvent(new Event('change'));
        gu.value=gn;gu.dispatchEvent(new Event('change'));
        sel.value=p;break outer;
      }}}}
  }
  document.querySelectorAll('.subj-pills .sp').forEach(function(b){b.addEventListener('click',function(){if(b.disabled)return;b.classList.toggle('on')})});
  // 지점 선택 시 해당 지점 미개설 과목은 선택 불가 처리. 학년급(초등·중등·고등)까지 고르면 그 학년급에 열리지 않은 과목도 막는다 (2026-09-17 점검 code#2)
  function updatePills(){
    var subs=null,gl=null;
    if(sel.value&&sido.value&&gu.value){
      (DATA[sido.value][gu.value]||[]).forEach(function(b){if(b.n===sel.value){subs=b.s||null;gl=b.g||null;}});
    }
    var lvSel=document.getElementById('fLv'),L=({'초등':'초','중등':'중','고등':'고'})[lvSel?lvSel.value:'']||'';
    document.querySelectorAll('.subj-pills .sp').forEach(function(b){
      var v=b.getAttribute('data-v');
      var ok=(!subs||subs.indexOf(v)>-1)&&(!L||!gl||!gl[v]||gl[v].indexOf(L)>-1);
      b.disabled=!ok;
      b.style.opacity=ok?'':'0.35';
      b.style.textDecoration=ok?'':'line-through';
      if(!ok)b.classList.remove('on');
    });
  }
  sel.addEventListener('change',updatePills);
  gu.addEventListener('change',updatePills);
  sido.addEventListener('change',updatePills);
  if(document.getElementById('fLv'))document.getElementById('fLv').addEventListener('change',updatePills);
  updatePills();
  var addrLayer=document.getElementById('addrLayer');
  function closeAddr(){addrLayer.style.display='none';document.getElementById('addrBox').innerHTML='';}
  document.getElementById('addrClose').addEventListener('click',closeAddr);
  addrLayer.addEventListener('click',function(e){if(e.target===addrLayer)closeAddr();});
  document.getElementById('addrBtn').addEventListener('click',function(){
    function openPost(){
      addrLayer.style.display='block';
      new daum.Postcode({
        oncomplete:function(d){document.getElementById('fAddr').value=d.roadAddress||d.address;closeAddr();},
        width:'100%',height:'100%'
      }).embed(document.getElementById('addrBox'));
    }
    if(window.daum&&window.daum.Postcode){openPost();return;}
    var s=document.createElement('script');s.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';s.onload=openPost;s.onerror=function(){alert('주소 검색을 불러오지 못했습니다. 주소를 칸에 직접 입력해 주세요.');var a=document.getElementById('fAddr');if(a)a.focus();};document.head.appendChild(s);
  });

  (function(){
    var lv=document.getElementById('fLv'),gd=document.getElementById('fGrade');
    if(!lv||!gd)return;
    var MAP={'초등':6,'중등':3,'고등':3};
    lv.addEventListener('change',function(){
      var n=MAP[lv.value]||0;
      gd.innerHTML='<option value="">'+(n?'학년 선택':'-')+'</option>';
      for(var i=1;i<=n;i++)gd.innerHTML+='<option>'+i+'학년</option>';
      gd.disabled=!n;
    });
  })();
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var f=e.target,btn=f.querySelector('.submit-btn');
    var subj=Array.from(document.querySelectorAll('.subj-pills .sp.on')).map(function(x){return x.getAttribute('data-v')}).join(', ');
    if(!f.이름.value.trim()){alert('학생 이름을 입력해 주세요.');f.이름.focus();return;}
    // 연락처 자릿수 (2026-09-17 점검 code#5): 010은 뒷자리 8자리(전체 11자리)만, 011·016~019는 뒷자리 7~8자리(전체 10~11자리)만 받는다.
    //   뒷자리 칸에 전체 번호를 적은 경우도 같은 기준으로 본다.
    var pd=String(f.연락처.value||'').replace(/\\D/g,''),pp=f.연락처앞?f.연락처앞.value:'010';
    var pOk=(pd.length===10||pd.length===11)&&/^01[016789]/.test(pd)?(pd.indexOf('010')===0?pd.length===11:true):(pd.length===8||(pd.length===7&&pp!=='010'));
    if(!pOk){alert(pp==='010'&&pd.length<10?'연락처를 다시 확인해 주세요. 010 번호는 뒷자리 8자리를 입력해 주세요.':'연락처를 다시 확인해 주세요. 앞자리를 고른 뒤 뒷자리 7~8자리를 입력해 주세요.');f.연락처.focus();return;}
    if(!f.거주주소.value.trim()){alert('주소를 입력해 주세요. 도로명 검색으로 찾거나 칸에 직접 적어 주셔도 됩니다.');f.거주주소.value='';f.거주주소.focus();return;}
    var lvEl=document.getElementById('fLv'),gdEl=document.getElementById('fGrade');
    if(!lvEl.value||(!gdEl.disabled&&!gdEl.value)){alert('학년을 선택해 주세요.');(lvEl.value?gdEl:lvEl).focus();return;}
    if(!subj){alert('희망 과목을 1개 이상 선택해 주세요.');return;}
    if(!document.getElementById('fAgree').checked){alert('개인정보 수집·이용에 동의해 주셔야 상담 신청이 접수됩니다.');document.getElementById('fAgree').focus();return;}
    btn.disabled=true;btn.textContent='전송 중...';
    function normPhone(p,v){v=String(v||'').replace(/\\D/g,'');if(v.length===11)return v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7);if(v.length===10)return v.slice(0,3)+'-'+v.slice(3,6)+'-'+v.slice(6);if(v.length===8)return p+'-'+v.slice(0,4)+'-'+v.slice(4);if(v.length===7)return p+'-'+v.slice(0,3)+'-'+v.slice(3);return p+'-'+v;}
    var data={지점:f.지점.value||'일반문의(와와학습학원)',이름:f.이름.value,연락처:normPhone(f.연락처앞?f.연락처앞.value:'010',f.연락처.value),거주주소:f.거주주소.value,학년:(function(){var sc=f.학교?f.학교.value.trim():'',lv=f.학년급?f.학년급.value:'',gd=f.학년상세?f.학년상세.value:'';return sc?[sc,gd||lv].filter(Boolean).join(' '):[lv,gd].filter(Boolean).join(' ');})(),학교:f.학교?f.학교.value.trim():'',과목:subj,신청일:new Date().toLocaleString('ko-KR'),유입페이지:location.href,유입페이지제목:document.title,유입경로:document.referrer||'직접입력'};
    var q=Object.keys(data).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(data[k])}).join('&');
    (new Image()).src='${GAS}?'+q;
    setTimeout(function(){f.style.display='none';document.getElementById('ok').classList.add('on');},700);
  });
})();
</script>`;
  write('inquiry/index.html', shell({
    title: `상담 신청 | ${BRAND}`,
    desc: `${BRAND} 상담 신청. 학생의 학교·학년·희망 과목을 남겨 주시면 지점에서 연락드립니다.`,
    canonical: `${DOMAIN}/inquiry/`, body, depth: 1,
  }));
}

// ── 개인정보처리방침 (2026-09-17 점검 code#0) ──
// 폼·t.js가 실제로 모으는 것만 적는다. 운영 법인명·보호책임자처럼 확인되지 않은 정보는 지어 넣지 말 것.
function buildPrivacy() {
  const body = `<div class="wrap">
${crumb(1, [{ name: '개인정보처리방침' }])}
<div class="page-head"><h1>개인정보처리방침</h1><div class="sub">${BRAND} 사이트(wstudycenter.com)가 상담 신청을 받을 때 어떤 정보를 받고, 어디에 쓰고, 언제 지우는지 적었습니다.</div></div>
<article class="body privacy">
<h2>1. 수집하는 항목</h2>
<ul>
<li>필수: 학생 이름, 연락처, 주소(도로명까지), 학년, 희망 과목</li>
<li>선택: 상담받을 지점, 학교 이름</li>
<li>신청할 때 함께 저장되는 정보: 신청 일시, 신청한 페이지 주소와 제목, 이전에 보던 페이지 주소(유입 경로)</li>
</ul>
<h2>2. 이용 목적</h2>
<p>상담 연락, 학생에게 맞는 수업과 지점 안내에만 씁니다. 받은 정보를 이 목적 밖에서 쓰지 않습니다.</p>
<h2>3. 처리 방법과 전달</h2>
<p>상담 신청 내용은 운영자가 관리하는 구글 시트에 저장되고, 상담을 맡을 와와 지점에 전달됩니다. 구글 시트는 Google LLC가 제공하는 서비스라 정보가 국외에 있는 Google 서버에 저장될 수 있습니다.</p>
<p>상담 문의와 이후 걸려 온 상담 전화를 이어서 관리하기 위해, 신청할 때 입력한 내용(이름·연락처·학년·주소 등)이 운영자의 상담 기록 시스템에도 함께 기록됩니다.</p>
<h2>4. 보유 기간과 파기</h2>
<p>상담 목적을 이루면 지체 없이 파기합니다. 법령에 따라 보관해야 하는 정보는 그 법령이 정한 기간 동안만 보관한 뒤 파기합니다.</p>
<h2>5. 제3자 제공</h2>
<p>와와 지점은 지점마다 따로 등록된 학원이라, 지점에 신청 내용을 넘기는 것은 제3자 제공에 해당합니다. 상담 신청서에서 수집·이용 동의와 따로 동의를 받은 경우에만 아래와 같이 제공합니다.</p>
<ul>
<li>받는 곳: 상담을 맡을 와와 지점</li>
<li>제공 목적: 상담 연락과 수업·지점 안내</li>
<li>제공 항목: 학생 이름, 연락처, 주소, 학년, 희망 과목, 학교 이름(적은 경우)</li>
<li>받는 곳의 보유 기간: 상담 목적을 이루면 지체 없이 파기하고, 법령에 따라 보관해야 하는 정보는 그 기간 동안만 보관합니다.</li>
</ul>
<p>이 밖에는 제3자에게 제공하지 않습니다. 법령에 따라 요구받는 경우는 예외입니다.</p>
<h2>6. 동의를 거부할 권리</h2>
<p>개인정보 수집·이용 동의와 상담 지점 제공 동의는 각각 거부할 수 있습니다. 어느 하나라도 거부하시면 온라인 상담 신청은 할 수 없고, <a href="tel:${TEL}" style="color:var(--brick);font-weight:700">전화 상담</a>은 그대로 이용할 수 있습니다.</p>
<h2>7. 열람·정정·삭제 요청</h2>
<p>남기신 정보의 열람, 정정, 삭제, 처리 정지를 언제든 요청할 수 있습니다. <a href="tel:${TEL}" style="color:var(--brick);font-weight:700">전화 상담</a>으로 말씀해 주시면 확인 후 처리합니다.</p>
<h2>8. 방문 기록</h2>
<p>사이트 이용 현황을 보기 위해 방문한 페이지, 유입 경로(검색어·광고 태그 포함), 전화·상담 버튼을 누른 기록을 남깁니다. IP 주소는 원래 값을 저장하지 않고 날짜마다 바뀌는 변환값만 남겨 방문자를 따로 알아볼 수 없게 합니다. 지도, 영상, 주소 검색은 외부 서비스(OpenStreetMap, YouTube, 카카오 우편번호 서비스)를 불러오며, 이 부분은 각 서비스의 개인정보 처리방침을 따릅니다.</p>
<h2>9. 개인정보 보호책임자</h2>
<p>개인정보 보호책임자는 ${BRAND} 사이트 운영 담당자입니다. 개인정보 처리에 관한 문의, 열람·정정·삭제 요청, 불만 처리와 피해 구제는 이메일 <a href="mailto:${PRIVACY_EMAIL}" style="color:var(--brick);font-weight:700">${PRIVACY_EMAIL}</a>, <a href="tel:${TEL}" style="color:var(--brick);font-weight:700">전화 상담</a>으로 받습니다.</p>
<h2>10. 시행일</h2>
<p>이 방침은 2026년 9월 17일부터 적용됩니다.</p>
</article>
${ctaBand(null, 1)}</div>`;
  write('privacy/index.html', shell({
    title: `개인정보처리방침 | ${BRAND}`,
    desc: `${BRAND} 상담 신청 시 수집하는 개인정보 항목, 이용 목적, 보유 기간 안내.`,
    canonical: `${DOMAIN}/privacy/`, body, depth: 1, robots: 'noindex,follow', fixedDate: '2026-09-17',
  }));
  urls.pop(); // noindex 페이지라 사이트맵에서 뺀다
}

// ── 이동 안내 페이지 공통 (noindex + canonical + meta refresh, juyeob2ho와 같은 틀) ──
// links: 본문에 함께 보여 줄 [이름, 주소] 목록 (여러 학교로 나뉜 옛 주소 등)
function movedStub(rel, url, links = []) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const more = links.length ? `\n<ul>\n${links.map(([n, u]) => `<li><a href="${u}">${esc(n)}</a></li>`).join('\n')}\n</ul>` : '';
  fs.writeFileSync(p, `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>페이지 이동 안내</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace("${url}");</script>
</head>
<body>
<p>페이지 주소가 변경되었습니다. <a href="${url}">이동하기</a></p>${more}
</body>
</html>
`, 'utf8');
}

// 공백으로 이어 적은 학교 항목이 학교 하나로 만들어졌던 옛 주소 18개 (2026-09-17 점검 code#1·copy#1).
// 기준본을 학교별로 나눈 뒤 옛 주소는 첫 학교 페이지로 옮기고, 나머지 학교 링크를 본문에 둔다. 사이트맵에는 넣지 않는다.
const SCHOOL_MOVED = {
  'daegu/bukgu': ['학남중 강북중'],
  'gyeongbuk/pohang': ['양덕초 양서초 장흥초', '양덕중 장흥중 대도중 환호여중', '장성고 포항고 포항여고 유성여고'],
  'gyeonggi/pyeongtaek': ['이화초 가내초 자란초', '비전중 한광중 한광여중 평택여중 소사벌중', '비전고 한광고 한광여고 평택여고'],
  'gyeonggi/bucheon': ['석천초  상인초', '석천중 상동중 상일중 부인중', '상동고 상일고 상원고 중흥고 중원고'],
  'chungbuk/cheongju': ['수곡중 산남중', '충북고 운호고 충북여고 산남고'],
  'gyeonggi/goyang': ['성라초 성사초', '화수중 성사중 원당중', '성사고 화수고'],
  'gyeonggi/namyangju': ['해밀초 화봉초', '풍양중 주곡중', '진접고 오남고'],
};
// 과목 중단으로 지운 동+과목 페이지 20쪽 (git 8a7a20c·f10de7f). 404 대신 지점 페이지로 옮긴다 (2026-09-17 점검 code#15).
const SUBJECT_MOVED = [
  'chungbuk/cheongju/gaesin/science', 'gyeonggi/ansan/gojan/korean', 'gyeonggi/gimpo/janggi/korean', 'gyeonggi/gimpo/janggi/science',
  'gyeonggi/gwangmyeong/soha/korean', 'daegu/donggu/isiapolliseu/social', 'gyeongbuk/pohang/duho/korean', 'gyeongbuk/pohang/duho/science',
  'gyeongbuk/pohang/duho/social', 'gyeonggi/gimpo/unyang/korean', 'gyeonggi/gimpo/unyang/social', 'gyeonggi/namyangju/pyeongnae/korean',
  'gyeonggi/namyangju/pyeongnae/science', 'gyeonggi/pyeongtaek/ichung/korean', 'gyeonggi/pyeongtaek/ichung/science', 'jeju/jeju-si/nohyeong/korean',
  'jeju/jeju-si/nohyeong/science', 'jeju/jeju-si/nohyeong/social', 'seoul/dongdaemun/jegi/social', 'ulsan/bukgu/songjeong/social',
];
const MOVED_LOG = { school: 0, subject: 0, skipped: [] };
function buildMovedPages() {
  const built = new Set(urls);
  for (const [dir, olds] of Object.entries(SCHOOL_MOVED)) {
    const [rs, ds] = dir.split('/');
    for (const old of olds) {
      if (built.has(`${dir}/school/${old}/`)) { MOVED_LOG.skipped.push(`${dir}/school/${old}`); continue; }
      const parts = normSchools([old]).filter((n) => schools[`${rs}/${ds}/${n}`]);
      const schoolUrl = (n) => `${DOMAIN}/${dir}/school/${encodeURIComponent(n)}/`;
      const target = parts.length ? schoolUrl(parts[0]) : `${DOMAIN}/${dir}/`;
      movedStub(`${dir}/school/${old}/index.html`, target, parts.map((n) => [`${n} 학원 안내`, schoolUrl(n)]));
      MOVED_LOG.school++;
    }
  }
  for (const rel of SUBJECT_MOVED) {
    if (built.has(`${rel}/`)) { MOVED_LOG.skipped.push(rel); continue; } // 과목이 다시 열려 페이지가 만들어졌으면 덮어쓰지 않는다
    const branchRel = rel.split('/').slice(0, 3).join('/') + '/';
    const target = built.has(branchRel) ? `${DOMAIN}/${branchRel}` : `${DOMAIN}/${rel.split('/').slice(0, 2).join('/')}/`;
    movedStub(`${rel}/index.html`, target);
    MOVED_LOG.subject++;
  }
}

// ── 404 (GitHub Pages가 없는 주소에 루트 404.html을 보여 준다, 2026-09-17 점검 code#15) ──
function build404() {
  const regionLinks = Object.values(regions).map((r) => `<a href="/${r.slug}/">${esc(r.name)}</a>`).join('');
  const body = `<div class="wrap">
<div class="page-head"><h1>페이지를 찾을 수 없습니다</h1><div class="sub">주소가 바뀌었거나 없어진 페이지입니다. 아래에서 지점이나 필요한 안내를 다시 찾아 주세요.</div></div>
<article class="body">
<div class="chips"><a href="/">홈으로</a><a href="/#regions">지역별 지점 찾기</a><a href="/inquiry/">상담 신청</a><a href="/guide/">공부법 칼럼</a><a href="/grade-calculator/">내신 등급 계산기</a></div>
<h2>지역에서 지점 찾기</h2>
<div class="chips">${regionLinks}</div>
</article>
${ctaBand(null, 0)}</div>`;
  const html = shell({
    title: `페이지를 찾을 수 없습니다 | ${BRAND}`,
    desc: `${BRAND} 사이트에서 요청한 페이지를 찾을 수 없습니다. 지역별 지점 찾기나 상담 신청으로 이동해 주세요.`,
    canonical: `${DOMAIN}/404.html`, body, depth: 0, robots: 'noindex', rootAbs: true,
  });
  // ctaBand(null, 0)의 상담 신청 링크는 상대경로('inquiry/')라 어느 깊이에서도 맞게 '/'로 바꾼다
  fs.writeFileSync(path.join(ROOT, '404.html'), html.replace(/href="inquiry\//g, 'href="/inquiry/'), 'utf8');
}

// ── 내신 등급 계산기 (유입용 도구 페이지, 2026-09-17) ──
// 산출 방식은 시도교육청 고등학교 학업성적관리 시행지침(2025학년도 부산 지침 확인): 등급별 누적 인원 = 수강자 수 × 누적 비율 반올림,
// 동점자가 등급 경계에 걸릴 때만 중간석차 백분율(중간석차 = 석차 + (동석차 인원 − 1) ÷ 2)로 등급을 준다. 계산은 브라우저에서만 하고 입력값을 보내거나 저장하지 않는다.
function buildGradeCalc() {
  const CUTS = { 5: [10, 34, 66, 90, 100], 9: [4, 11, 23, 40, 60, 77, 89, 96, 100] };
  const FAQ = [
    { q: '5등급과 9등급 중 어느 쪽으로 계산하나요?', a: '2025학년도에 고등학교에 입학한 학생부터 5등급 체제가 적용됩니다. 2024학년도 이전에 입학한 학생은 9등급 체제로 성적이 나옵니다.' },
    { q: '평균 등급은 어떻게 계산하나요?', a: '과목 등급에 학점(단위수)을 곱해 더한 뒤 학점 합으로 나눈 값입니다. 성적을 어디에 쓰느냐에 따라 반영 과목과 계산 방식이 달라서, 이 계산기의 평균은 참고용으로만 보세요.' },
    { q: '입력한 성적이 저장되나요?', a: '저장하지 않습니다. 계산은 이 화면 안에서만 이뤄지고, 입력한 숫자를 어디로도 보내지 않습니다.' },
  ];
  // 마지막 등급은 '100%' 대신 앞 등급 경계 초과로 적는다
  const cutRow = (sys) => CUTS[sys].map((p, i, a) => `<td>${i + 1}등급<br><b>${i === 0 ? `${p}% 이하` : i === a.length - 1 ? `${a[i - 1]}% 초과` : `${p}%`}</b></td>`).join('');
  const body = `<div class="wrap">
${crumb(1, [{ name: '내신 등급 계산기' }])}
<div class="page-head"><span class="tag">고등학교 내신</span><h1>내신 등급 계산기</h1><div class="sub">과목별 석차와 수강자 수를 넣으면 석차등급을 계산합니다. 2025년 고1부터 적용되는 5등급과 2024년 이전 입학생의 9등급 중에서 고를 수 있습니다.</div></div>
<div class="calc" id="calc" data-mode="rank">
<div class="calc-top">
<div class="calc-opt" role="radiogroup" aria-label="등급 체계"><span class="calc-lab">등급 체계</span><label><input type="radio" name="sys" value="5" checked> 5등급 <em>2025년 이후 입학</em></label><label><input type="radio" name="sys" value="9"> 9등급 <em>2024년 이전 입학</em></label></div>
<div class="calc-opt" role="radiogroup" aria-label="입력 방식"><span class="calc-lab">입력 방식</span><label><input type="radio" name="mode" value="rank" checked> 석차와 수강자 수</label><label><input type="radio" name="mode" value="pct"> 석차 백분율</label></div>
</div>
<div id="cRows"></div>
<div class="calc-btns"><button type="button" id="cAdd">과목 추가</button><button type="button" id="cReset" class="ghost">모두 지우기</button></div>
<div class="calc-sum" id="cSum" aria-live="polite"></div>
<noscript><p class="calc-empty">계산기는 브라우저에서 자바스크립트가 켜져 있어야 동작합니다.</p></noscript>
</div>
<p class="calc-foot">학교 학업성적관리규정과 실제 성적표가 기준입니다. 이 계산기는 결과를 확인해 보는 참고용이고, 결과를 보장하지 않습니다.</p>
<article class="body">
<h2>석차등급은 이렇게 정해집니다</h2>
<p>고등학교 성적표의 석차등급은 과목 석차를 수강자 수에 비춰 정합니다. 먼저 수강자 수에 등급별 누적 비율을 곱하고 반올림해 등급별 누적 인원을 구합니다. 석차가 그 인원 안에 들면 해당 등급입니다.</p>
<p>예를 들어 5등급 체제에서 수강자가 178명이면 1등급 누적 인원은 17.8을 반올림한 18명이고, 2등급 누적 인원은 60.52를 반올림한 61명입니다. 석차 18등까지 1등급, 19등부터 61등까지 2등급입니다.</p>
<div class="tbl-scroll"><table class="info-table calc-cuts"><tbody>
<tr><th>5등급<br><span>2025년 이후 입학</span></th>${cutRow(5)}</tr>
</tbody></table></div>
<div class="tbl-scroll"><table class="info-table calc-cuts"><tbody>
<tr><th>9등급<br><span>2024년 이전 입학</span></th>${cutRow(9)}</tr>
</tbody></table></div>
<p style="color:var(--ink-soft);font-size:14px">표의 숫자는 누적 비율입니다. 5등급 체제의 2등급은 10% 초과 34% 이하입니다.</p>
<h2>동점자가 등급 경계에 걸리면</h2>
<p>동점자는 모두 같은 석차를 받고, 성적표에는 동석차 인원이 함께 적힙니다. 동점자 무리가 등급 경계에 걸쳐 있으면 중간석차 백분율로 등급을 줍니다.</p>
<ul>
<li>중간석차 = 석차 + (동석차 인원 − 1) ÷ 2</li>
<li>중간석차 백분율 = 중간석차 ÷ 수강자 수 × 100</li>
</ul>
<p>이 백분율을 위 누적 비율과 비교합니다. 수강자 96명인 과목에서 1등 동점자가 19명이면 중간석차는 10, 백분율은 약 10.4%라서 5등급 체제에서는 19명 모두 2등급이 됩니다. 동점자가 한 등급 범위 안에 모여 있으면 중간석차를 쓰지 않습니다. 동점자를 줄이는 처리 방법은 학교마다 학업성적관리규정으로 정합니다.</p>
<h2>결과를 볼 때 확인할 것</h2>
<ul>
<li>이 계산기는 시도교육청 학업성적관리 시행지침의 산출 방식을 따랐습니다. 실제 등급은 학교 규정과 성적표가 기준입니다.</li>
<li>석차등급을 내지 않는 과목도 있습니다. 2025년 이후 입학생은 과학탐구실험, 체육·예술 과목, 교양 과목, 사회·과학 교과의 융합 선택 과목이 해당하고, 2024년 이전 입학생은 성취도(A·B·C)만 내는 선택 과목 등이 해당합니다.</li>
<li>수강자가 적은 과목(5등급 체제 5명 이하, 9등급 체제 13명 이하)은 석차등급 칸에 등급 대신 '·'을 적을 수 있습니다.</li>
<li>석차 백분율로 넣으면 누적 인원 반올림이 반영되지 않아, 등급 경계 근처에서는 석차로 계산한 결과와 한 등급 차이가 날 수 있습니다.</li>
</ul>
${guideLinks(['high1-first-exam', 'exam-4weeks', 'performance-assessment', 'high23-balance'], 1, '함께 읽을 내신 칼럼')}
<h2>자주 묻는 질문</h2>
<div class="faq">${FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
</article>
${ctaBand(null, 1)}</div>
<script>
(function(){
  var CUTS=${JSON.stringify(CUTS)};
  var calc=document.getElementById('calc'),rows=document.getElementById('cRows'),sum=document.getElementById('cSum');
  if(!calc)return;
  var seq=0;
  function field(cls,label,name,attrs){return '<label class="f '+cls+'"><span>'+label+'</span><input name="'+name+'" '+attrs+'></label>';}
  function addRow(){
    seq++;
    var d=document.createElement('div');
    d.className='c-row';
    d.innerHTML='<div class="c-head"><b class="c-no"></b><button type="button" class="c-del" aria-label="이 과목 지우기">삭제</button></div>'+
      '<div class="c-grid">'+
      field('all','과목명(선택)','subj','type="text" maxlength="20" placeholder="예: 공통수학1"')+
      field('all','학점(단위)','cr','type="number" inputmode="decimal" min="0.5" step="0.5" placeholder="비우면 1"')+
      field('rank','석차','rank','type="number" inputmode="numeric" min="1" step="1" placeholder="예: 12"')+
      field('rank','동석차 인원','tie','type="number" inputmode="numeric" min="1" step="1" placeholder="없으면 1"')+
      field('rank','수강자 수','n','type="number" inputmode="numeric" min="1" step="1" placeholder="예: 178"')+
      field('pct','석차 백분율(%)','pct','type="number" inputmode="decimal" min="0" max="100" step="0.01" placeholder="예: 7.5"')+
      '</div><div class="c-out"></div>';
    rows.appendChild(d);
    renumber();calcAll();
  }
  function renumber(){var rs=rows.querySelectorAll('.c-row');for(var i=0;i<rs.length;i++)rs[i].querySelector('.c-no').textContent='과목 '+(i+1);}
  function num(el){var v=el.value.trim();if(v==='')return null;var x=Number(v);return isFinite(x)?x:NaN;}
  function isInt(x){return x!==null&&!isNaN(x)&&Math.floor(x)===x;}
  function sys(){var r=calc.querySelector('input[name=sys]:checked');return r?r.value:'5';}
  function mode(){var r=calc.querySelector('input[name=mode]:checked');return r?r.value:'rank';}
  function fmt(x){return Math.round(x*100)/100;}
  function one(row){
    var cuts=CUTS[sys()],m=mode(),g=function(n){return row.querySelector('input[name='+n+']');};
    var cr=num(g('cr'));
    if(cr!==null&&(isNaN(cr)||cr<=0))return {err:'학점은 0보다 큰 숫자로 넣어 주세요.'};
    var w=cr===null?1:cr;
    if(m==='pct'){
      var p=num(g('pct'));
      if(p===null)return {empty:'석차 백분율을 넣으면 등급이 나옵니다.'};
      if(isNaN(p)||p<=0||p>100)return {err:'석차 백분율은 0보다 크고 100 이하인 숫자로 넣어 주세요.'};
      for(var i=0;i<cuts.length;i++)if(p<=cuts[i]+1e-9)return {grade:i+1,w:w,why:'석차 백분율 '+fmt(p)+'% · '+(i+1)+'등급 '+(i===cuts.length-1?'(누적 비율 '+cuts[i-1]+'% 초과)':'누적 비율 '+cuts[i]+'% 이하')};
    }
    var r=num(g('rank')),t=num(g('tie')),n=num(g('n'));
    if(r===null||n===null)return {empty:'석차와 수강자 수를 넣으면 등급이 나옵니다.'};
    if(t===null)t=1;
    if(!isInt(r)||!isInt(n)||!isInt(t)||r<1||n<1||t<1)return {err:'석차, 동석차 인원, 수강자 수는 1 이상의 정수로 넣어 주세요.'};
    if(r+t-1>n)return {err:'석차와 동석차 인원을 합친 범위가 수강자 수보다 큽니다. 숫자를 다시 확인해 주세요.'};
    var cum=cuts.map(function(c){return Math.round(n*c/100);});
    cum[cum.length-1]=n;
    var last=r+t-1,g1=-1,g2=-1;
    for(var k=0;k<cum.length;k++){if(g1<0&&r<=cum[k])g1=k;if(g2<0&&last<=cum[k])g2=k;}
    var cumTxt='등급별 누적 인원: '+cum.map(function(c,i){return (i+1)+'등급 '+c+'명';}).join(' · ');
    var small=(sys()==='5'&&n<=5)||(sys()==='9'&&n<=13)?'수강자가 '+n+'명이라 학교에 따라 석차등급 대신 \\'·\\'으로 적을 수 있습니다.':'';
    if(g1===g2)return {grade:g1+1,w:w,why:'석차 '+r+'등'+(t>1?'(동석차 '+t+'명)':'')+' · '+(g1+1)+'등급 누적 인원 '+cum[g1]+'명 안',cum:cumTxt,small:small};
    var mid=r+(t-1)/2,pct=mid/n*100,gm=cuts.length;
    for(var j=0;j<cuts.length;j++)if(pct<=cuts[j]+1e-9){gm=j+1;break;}
    return {grade:gm,w:w,why:'동점자가 등급 경계에 걸려 중간석차 '+fmt(mid)+'등, 중간석차 백분율 '+fmt(pct)+'%로 계산',cum:cumTxt,small:small};
  }
  function calcAll(){
    calc.setAttribute('data-mode',mode());
    var rs=rows.querySelectorAll('.c-row'),tot=0,ws=0,cnt=0;
    for(var i=0;i<rs.length;i++){
      var o=one(rs[i]),out=rs[i].querySelector('.c-out');
      out.className='c-out'+(o.err?' err':o.empty?' wait':' ok');
      out.innerHTML='';
      if(o.err||o.empty){out.textContent=o.err||o.empty;continue;}
      var gEl=document.createElement('span');gEl.className='g';gEl.textContent=o.grade+'등급';out.appendChild(gEl);
      var wEl=document.createElement('span');wEl.className='why';wEl.textContent=o.why;out.appendChild(wEl);
      if(o.cum){var cEl=document.createElement('span');cEl.className='cum';cEl.textContent=o.cum;out.appendChild(cEl);}
      if(o.small){var sEl=document.createElement('span');sEl.className='cum';sEl.textContent=o.small;out.appendChild(sEl);}
      tot+=o.grade*o.w;ws+=o.w;cnt++;
    }
    sum.innerHTML='';
    if(!cnt){sum.textContent='과목을 하나 이상 계산하면 학점 가중 평균이 여기에 나옵니다.';sum.className='calc-sum wait';return;}
    sum.className='calc-sum';
    var a=document.createElement('b');a.textContent='평균 '+(Math.round(tot/ws*100)/100).toFixed(2)+'등급';sum.appendChild(a);
    var b=document.createElement('span');b.textContent='과목 '+cnt+'개, 학점 합 '+fmt(ws)+' 기준 학점 가중 평균 ('+sys()+'등급 체제, 참고용)';sum.appendChild(b);
  }
  rows.addEventListener('input',calcAll);
  rows.addEventListener('click',function(e){var del=e.target.closest('.c-del');if(!del)return;var row=del.closest('.c-row');if(rows.querySelectorAll('.c-row').length>1){row.parentNode.removeChild(row);}else{var ins=row.querySelectorAll('input');for(var i=0;i<ins.length;i++)ins[i].value='';}renumber();calcAll();});
  calc.addEventListener('change',function(e){if(e.target.name==='sys'||e.target.name==='mode')calcAll();});
  document.getElementById('cAdd').addEventListener('click',function(){if(rows.querySelectorAll('.c-row').length<20)addRow();});
  document.getElementById('cReset').addEventListener('click',function(){rows.innerHTML='';addRow();addRow();addRow();});
  addRow();addRow();addRow();
})();
</script>`;
  const faqLd = { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  write('grade-calculator/index.html', shell({
    title: `내신 등급 계산기 (5등급·9등급) | ${BRAND}`,
    desc: fitDesc(`과목별 석차와 수강자 수로 고등학교 내신 석차등급을 계산합니다. 2025년 고1부터 5등급, 이전 입학생은 9등급 기준입니다.`),
    canonical: `${DOMAIN}/grade-calculator/`, body, depth: 1,
    ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebApplication', name: '내신 등급 계산기', applicationCategory: 'EducationalApplication', operatingSystem: 'Any', url: `${DOMAIN}/grade-calculator/`, isAccessibleForFree: true, inLanguage: 'ko-KR', publisher: { '@type': 'Organization', name: BRAND } }, faqLd] },
  }));
}

// ── 실행 ──
buildHome();
buildInquiry();
buildPrivacy();
buildGuideIndex();
for (const g of GUIDES) buildGuide(g);
buildGuideMoved();
buildReview();
buildGradeCalc();
for (const r of Object.values(regions)) {
  buildRegion(r);
  for (const d of Object.values(r.districts)) {
    buildDistrict(r, d);
    for (const b of d.branches) {
      buildBranch(r, d, b);
      for (const subj of b.subjects || []) if (SUBJ_SLUG[subj]) buildSubject(r, d, b, subj);
    }
  }
}
for (const s of Object.values(schools)) buildSchool(s);
buildMovedPages();
build404();

// 검색 인덱스 (홈 지점/학교 검색용 — 첫 입력 시 lazy 로드)
const searchIndex = [];
for (const r of Object.values(regions)) for (const d of Object.values(r.districts)) for (const b of d.branches) {
  searchIndex.push({ t: '지점', n: b.name, s: `${b.region} ${b.district} ${b.dong}`, u: `/${r.slug}/${d.slug}/${b.branch_slug}/` });
}
for (const s of Object.values(schools)) {
  searchIndex.push({ t: '학교', n: s.name, s: `${s.region} ${s.district} · ${s.branches[0].name}`, u: `/${s.region_slug}/${s.district_slug}/school/${encodeURIComponent(s.name)}/` });
}
fs.writeFileSync(path.join(ROOT, 'assets', 'search-index.json'), JSON.stringify(searchIndex), 'utf8');
console.log('검색 인덱스:', searchIndex.length, '건');

// sitemap / robots / CNAME / favicon
// lastmod는 URL마다 그 페이지의 dateModified(pageDates, 월 단위)와 동일 — 빌드 날짜 일괄 기입 아님
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `<url><loc>${DOMAIN}/${encodeURI(u)}</loc><lastmod>${pageDates(u).dateModified}</lastmod></url>`).join('\n') + '\n</urlset>', 'utf8');
// 이번 빌드에서 새로 생긴 페이지의 공개일을 기록한다 (다음 빌드부터는 사이트맵에 있어도 이 날짜를 발행일로 쓴다)
if (PAGE_BORN_NEW.length) {
  fs.writeFileSync(PAGE_DATES_FILE, JSON.stringify(PAGE_DATES, null, 1) + '\n', 'utf8');
  console.log('새 페이지 공개일 기록:', PAGE_BORN_NEW.length, '건 →', path.relative(ROOT, PAGE_DATES_FILE), PAGE_BORN_NEW.slice(0, 5).join(', '));
}
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`, 'utf8');
// IndexNow 키 검증 파일 (제출 크론은 sangsang-workers 중앙 크론이 매일 실행)
fs.writeFileSync(path.join(ROOT, '5e5ad86af25533efae3948773b676a6c.txt'), '5e5ad86af25533efae3948773b676a6c', 'utf8');
// RSS (공부법 칼럼 전체 — 네이버 서치어드바이저 RSS 제출용. 2026-09-17 입시 칼럼 2편 정리 뒤 31편)
{
  const rfc822 = (d) => new Date(d + 'T09:00:00+09:00').toUTCString();
  // pubDate는 칼럼 페이지의 datePublished와 같은 값(목록 순서가 바뀌어도 글마다 고정)
  const items = GUIDES.map((g) => {
    const pub = pageDates(`guide/${g.slug}/`).datePublished;
    return `<item><title>${esc(g.title)}</title><link>${DOMAIN}/guide/${g.slug}/</link><guid isPermaLink="true">${DOMAIN}/guide/${g.slug}/</guid><description>${esc(g.desc)}</description><category>${esc(g.cat)}</category><pubDate>${rfc822(pub)}</pubDate></item>`;
  }).join('\n');
  fs.writeFileSync(path.join(ROOT, 'rss.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>${BRAND} 공부법 칼럼</title>\n<link>${DOMAIN}/guide/</link>\n<description>공부 습관, 내신 대비, 과목별 공부법, 학년별 가이드까지 ${BRAND}이 정리한 공부법 칼럼</description>\n<language>ko</language>\n<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n</channel></rss>`, 'utf8');
}
fs.writeFileSync(path.join(ROOT, 'CNAME'), 'wstudycenter.com\n', 'utf8');
fs.writeFileSync(path.join(ROOT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#22314e"/><text x="32" y="44" font-size="34" font-weight="800" text-anchor="middle" fill="#f0b58f" font-family="sans-serif">W</text></svg>`, 'utf8');
console.log('생성 완료:', urls.length, '페이지');
console.log('이동 안내 페이지: 학교', MOVED_LOG.school, '· 과목', MOVED_LOG.subject, MOVED_LOG.skipped.length ? '· 건너뜀 ' + MOVED_LOG.skipped.join(', ') : '');
if (DATA_WARN.length) console.warn('[데이터 경고]\n  ' + DATA_WARN.join('\n  '));
if (SCHOOL_NO_SUBJ.length) console.warn('[학교급에 개설 과목 없는 학교 페이지]', SCHOOL_NO_SUBJ.length, SCHOOL_NO_SUBJ.slice(0, 10).join(', '));
// description 80자(네이버 권고) 전수 점검 — 넘으면 목록을 출력한다 (2026-09-17 점검 code#8)
{
  const over = [];
  for (const u of urls) {
    const html = fs.readFileSync(path.join(ROOT, u, 'index.html'), 'utf8');
    const m = html.match(/<meta name="description" content="([^"]*)">/);
    const d = m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
    if (d.length > 80 || /\s{2,}/.test(d)) over.push(`${u} (${d.length}) ${d}`);
  }
  console.log('description 80자 초과·겹친 공백:', over.length);
  if (over.length) console.warn('  ' + over.slice(0, 20).join('\n  '));
}
