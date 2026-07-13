// 와와학습학원 (wstudycenter.com) 정적 페이지 생성기
// 실행: node build.js  → 폴더 루트에 페이지 생성 (center 저장소와 같은 배포 패턴)
const fs = require('fs');
const path = require('path');
const BRANCHES = require('./data/branches.json');
const VIDEOS = require('./data/videos.json');
const COPY = require('./lib/copy.js');
const GUIDES = [...require('./lib/guides-habit.js'), ...require('./lib/guides-subject.js'), ...require('./lib/guides-grade.js')];
const SCHOOL_INFO = fs.existsSync(path.join(__dirname, 'data', 'school-info.json')) ? require('./data/school-info.json') : {};

const ROOT = __dirname;
const DOMAIN = 'https://wstudycenter.com';
const BRAND = '와와학습학원';
const TEL = '010-4864-5345';
const GAS = 'https://script.google.com/macros/s/AKfycbybsuTZMjzlp3HkkVaUX0IUFnNlSfnnN0DGThb-2BOIwZ8IyZNnMgkwoWOb_muHCEx5/exec';
const TRACKER = '<script defer src="https://xn--vb0by3y5wigqb.com/t.js" data-site="wstudy"></script>';
const SUBJ_SLUG = { 영어: 'english', 수학: 'math', 국어: 'korean', 과학: 'science', 사회: 'social' };

// ── 유틸 ──
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
function pick(arr, key) { return arr[hash(key) % arr.length]; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function write(rel, html) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, 'utf8');
  urls.push(rel.replace(/index\.html$/, '').replace(/\\/g, '/'));
}
// 수강료: wcoachingcenter.com과 동일한 회비 표 (와와회비A/B, 학년 × 주2·3·5회 월액)
const FEE_TABLES = {
  A: { 초등: ['160,000', '230,000', '370,000'], 중등: ['172,000', '247,000', '397,000'], 고등: ['195,000', '280,000', '450,000'] },
  B: { 초등: ['140,000', '200,000', '320,000'], 중등: ['152,000', '217,000', '347,000'], 고등: ['175,000', '250,000', '400,000'] },
};
function feeSection(b) {
  const t = FEE_TABLES[/A/.test(b.fee_type || '') ? 'A' : 'B'];
  const rows = Object.entries(t).map(([lv, p]) => `<tr><th>${lv}</th><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td></tr>`).join('');
  return `<h2>수강료 안내</h2><p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">교육청 등록 기준 공시 금액(월, 원)입니다. 자세한 시간, 횟수는 상담 시 조율합니다.</p>
<div class="tbl-scroll"><table class="info-table fee-table"><thead><tr><th>학년</th><th>주2회</th><th>주3회</th><th>주5회</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ── 데이터 구조화 ──
// 학교명 정규화: "쌍용초.미라초." / "나곡중/보라중/상갈중" 처럼 붙은 항목을 분리 (경로 문자 제거)
function normSchools(arr) {
  const out = [];
  for (const s of arr || []) for (const p of String(s).split(/[./\\]/)) { const t = p.trim(); if (t.length >= 2 && !out.includes(t)) out.push(t); }
  return out;
}
const regions = {}; // region_slug -> {name, districts: {district_slug: {name, branches:[]}}}
for (const [name, b] of Object.entries(BRANCHES)) {
  b.name = name;
  b.schools_elem = normSchools(b.schools_elem);
  b.schools_mid = normSchools(b.schools_mid);
  b.schools_high = normSchools(b.schools_high);
  const r = (regions[b.region_slug] = regions[b.region_slug] || { name: b.region, slug: b.region_slug, districts: {} });
  const d = (r.districts[b.district_slug] = r.districts[b.district_slug] || { name: b.district, slug: b.district_slug, branches: [] });
  d.branches.push(b);
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
function shell({ title, desc, canonical, body, depth, ld, ogTitle, footExtra }) {
  const base = depth ? '../'.repeat(depth) : './';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="${BRAND}">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/style.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head>
<body>
<div class="topbar"><span>초·중·고 교과 전문 ${BRAND}</span><a href="tel:${TEL}">전화 상담</a></div>
<header class="site"><div class="in">
<a class="logo" href="${base}">와와학습학원<span class="dot">.</span></a>
<nav class="gnb"><a href="${base}guide/">공부법 칼럼</a><a href="${base}review/">수강후기</a><a class="cta" href="${base}inquiry/">상담 신청</a></nav>
</div></header>
${body}
<footer class="site"><div class="in">
<div class="brand">${BRAND}</div>
전국 지점에서 초·중·고 교과 수업과 학교별 내신 관리를 합니다.<br>
<a href="tel:${TEL}">전화 상담</a> · <a href="${base}inquiry/">상담 신청</a> · <a href="${base}review/">수강후기</a><br>
교습소·학원 등록번호는 각 지점 페이지에 표기되어 있습니다. © ${BRAND}
${footExtra ? `<div class="foot-reg">${footExtra}</div>` : ''}
</div></footer>
<div class="float-cta"><a class="f-form" href="${base}inquiry/">상담 문의</a><a class="f-tel" href="tel:${TEL}">전화 상담</a></div>
${TRACKER}
</body>
</html>`;
}
function crumb(depth, items) {
  const base = '../'.repeat(depth);
  let html = `<div class="crumb"><a href="${base}">홈</a>`;
  let acc = base;
  for (let i = 0; i < items.length; i++) {
    if (i < items.length - 1) { acc += items[i].slug + '/'; html += `<span>›</span><a href="${acc}">${esc(items[i].name)}</a>`; }
    else html += `<span>›</span>${esc(items[i].name)}`;
  }
  return html + '</div>';
}
function video(v, cap) {
  if (!v) return '';
  return `<div class="video-box"><div class="frame"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${v.id}" title="${esc(v.title)}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><div class="cap">▶ ${esc(cap || v.title)} (와와 공식 유튜브)</div></div>`;
}
function ctaBand(b, depth) {
  const base = '../'.repeat(depth);
  const q = b ? '?지점=' + encodeURIComponent(b.name) : '';
  return `<div class="cta-band"><div class="t">상담 안내</div><div class="d">학생의 학교, 학년, 현재 성적을 알려 주시면 필요한 수업을 구체적으로 안내해 드립니다.</div><div class="btns"><a class="tel" href="tel:${TEL}">전화 상담</a><a class="form" href="${base}inquiry/${q}">상담 신청서 작성</a>${b && b.link ? `<a class="map" href="${b.link}" target="_blank" rel="noopener">지도에서 위치 보기</a>` : ''}</div></div>`;
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
  return `<h2>${title || '함께 읽을 공부법 칼럼'}</h2><div class="chips">${items.map((g) => `<a href="${base}guide/${g.slug}/">${esc(g.title)}</a>`).join('')}</div>`;
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
function nearbyRow(b) {
  const nb = (b.nearby_text || '').split('/').slice(1).join('').trim();
  return nb ? `<tr><th>주변</th><td>${esc(nb)}</td></tr>` : '';
}
function classPhoto(depth) {
  return `<div class="photo"><img loading="lazy" src="${'../'.repeat(depth)}assets/wawa-class.jpg" alt="와와 교실 내부" width="900" height="664"><div class="cap">와와 교실 환경 — 지점별 시설과 배치는 다를 수 있습니다.</div></div>`;
}
const LEVEL_GUIDES = {
  초: ['elem-habit', 'pre-middle', 'study-planner'],
  중: ['exam-4weeks', 'performance-assessment', 'wrong-note'],
  고: ['high1-first-exam', 'saenggibu-setek', 'high23-balance'],
};

function branchVideo(b) {
  if (VIDEOS.branch[b.name]) return VIDEOS.branch[b.name];
  const stem = b.name.replace(/\(.*\)$/, '');
  if (VIDEOS.branch[stem]) return VIDEOS.branch[stem];
  if (/\(W\+\)/.test(b.name)) return VIDEOS.wplus;
  return null;
}
function levelsOf(b) {
  const l = [];
  if ((b.schools_elem || []).length) l.push('초');
  if ((b.schools_mid || []).length) l.push('중');
  if ((b.schools_high || []).length) l.push('고');
  return l.length ? l : ['초', '중', '고'];
}
function schoolShort(b) {
  const mids = [...(b.schools_mid || []), ...(b.schools_high || [])];
  const arr = mids.length ? mids : (b.schools_elem || []);
  return arr.slice(0, 3).join('·') || b.dong + ' 인근 학교';
}

// ── 홈 ──
function buildHome() {
  const total = Object.keys(BRANCHES).length;
  const regionCards = Object.values(regions)
    .sort((a, b) => Object.values(b.districts).reduce((n, d) => n + d.branches.length, 0) - Object.values(a.districts).reduce((n, d) => n + d.branches.length, 0))
    .map((r) => {
      const n = Object.values(r.districts).reduce((s, d) => s + d.branches.length, 0);
      return `<a href="./${r.slug}/">${esc(r.name)}<span class="cnt">지점 ${n}곳</span></a>`;
    }).join('');
  const body = `
<div class="hero"><div class="in">
<h1>학교 시험은<br><em>학교를 아는 학원</em>에서</h1>
<p>${BRAND}은 전국 ${total}개 지점이 있는 초·중·고 교과 학원입니다. 학생이 다니는 학교의 진도에 맞춰 수업하고, 시험 기간에는 학교별 자료로 내신을 준비합니다.</p>
<div class="btns"><a class="b1" href="./inquiry/">상담 신청</a><a class="b2" href="#regions">가까운 지점 찾기</a></div>
<div class="stats"><div class="s"><div class="n">${total}</div><div class="k">전국 지점</div></div><div class="s"><div class="n">${Object.keys(schools).length.toLocaleString()}</div><div class="k">관리 학교</div></div><div class="s"><div class="n">5과목</div><div class="k">국·영·수·사·과</div></div></div>
</div></div>
<div class="wrap"><section class="home">
<h2 id="regions">지역별 지점 찾기</h2>
<div class="sec-sub">지역을 선택하면 시·군·구별 지점과 관리 학교를 볼 수 있습니다.</div>
<div class="list-grid">${regionCards}</div>

<h2>수업 방식</h2>
<article class="body">
<p>지점마다 인근 학교 재학생들이 다니기 때문에 학교별 진도와 시험 정보가 매 학기 쌓입니다. 평소에는 학교 진도에 맞춰 수업하고, 시험 3~4주 전부터는 그 자료로 학교별 내신 대비에 들어갑니다.</p>
<p>수업은 개별 진도입니다. 같은 시간에 앉아 있어도 학생마다 교재와 단원이 다릅니다. 진단으로 시작점을 정하고, 숙제와 테스트로 학습량을 유지하고, 시험 결과를 보고 다음 계획을 조정합니다.</p>
<div class="note">2025년 소비자가 뽑은 올해의 대상(교육 부문)을 수상했습니다.</div>
</article>

<h2>공부법 칼럼</h2>
<div class="sec-sub">학원에서 학생들을 가르치며 정리한 공부 방법입니다. <a href="./guide/" style="color:var(--brick);font-weight:600">전체 ${GUIDES.length}편 보기</a></div>
<div class="list-grid">${['exam-4weeks', 'study-planner', 'math-wrong', 'english-voca', 'saenggibu-setek', 'pre-high'].map((s) => { const g = GUIDES.find((x) => x.slug === s); return `<a href="./guide/${g.slug}/">${esc(g.title)}<span class="cnt">${esc(g.cat)}</span></a>`; }).join('')}</div>

<h2>유튜브 영상</h2>
<div class="sec-sub">공식 유튜브 채널의 지점, 학습법 영상입니다.</div>
${video(VIDEOS.pools.interview[0], '합격 인터뷰: 평택 와와에서 서울대 합격생이 나온 이유')}
${video(VIDEOS.pools.brand[5], '2025 소비자가 뽑은 올해의 대상 수상')}
<p style="font-size:14px;color:var(--ink-soft)">더 많은 영상은 <a href="https://www.youtube.com/@wawacoachingcenter" target="_blank" rel="noopener" style="color:var(--brick);font-weight:600">유튜브 채널</a>에서 볼 수 있습니다.</p>
${ctaBand(null, 0)}
</section></div>`;
  write('index.html', shell({
    title: `${BRAND} | 초중고 교과·내신 전문, 전국 ${total}개 지점`,
    desc: `학교 진도와 출제 경향에 맞추는 초·중·고 학원. 전국 ${total}개 지점, ${Object.keys(schools).length.toLocaleString()}개 학교 관리. 국어·영어·수학·사회·과학.`,
    canonical: DOMAIN + '/', body, depth: 0,
    ld: { '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: BRAND, url: DOMAIN, telephone: TEL, description: '초중고 교과 수업과 학교별 내신 관리 전문 학원' },
  }));
}

// ── 지역 허브 ──
function buildRegion(r) {
  const dists = Object.values(r.districts).sort((a, b) => b.branches.length - a.branches.length);
  const cards = dists.map((d) => `<a href="./${d.slug}/">${esc(d.name)}<span class="cnt">지점 ${d.branches.length}곳 · ${d.branches.map((b) => b.name).slice(0, 3).join(', ')}${d.branches.length > 3 ? ' 외' : ''}</span></a>`).join('');
  const n = dists.reduce((s, d) => s + d.branches.length, 0);
  const body = `<div class="wrap">
${crumb(1, [{ name: r.name }])}
<div class="page-head"><span class="tag">지역 안내</span><h1>${esc(r.name)} ${BRAND} 지점</h1><div class="sub">${esc(r.name)}에는 ${n}개 지점이 있습니다. 시·군·구를 선택하면 지점별 과목과 관리 학교를 볼 수 있습니다.</div></div>
<article class="body"><div class="list-grid">${cards}</div></article>
${ctaBand(null, 1)}</div>`;
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
    schoolHtml += `<h3>${lv === '초' ? '초등학교' : lv === '중' ? '중학교' : '고등학교'}</h3><div class="chips">${arr.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => `<a href="./school/${encodeURIComponent(s.name)}/">${esc(s.name)}</a>`).join('')}</div>`;
  }
  const body = `<div class="wrap">
${crumb(2, [{ name: r.name, slug: r.slug }, { name: d.name }])}
<div class="page-head"><span class="tag">${esc(r.name)}</span><h1>${esc(d.name)} 초중고 학원, ${BRAND}</h1><div class="sub">${esc(d.name)}의 ${d.branches.length}개 지점이 인근 ${schoolsHere.length}개 학교의 진도와 내신을 관리합니다.</div></div>
<article class="body">
<h2>${esc(d.name)} 지점</h2><div class="list-grid">${bCards}</div>
<h2>관리 학교별 안내</h2>
<p>학교 이름을 선택하면 그 학교 재학생을 위한 내신 대비 안내 페이지로 이동합니다.</p>
${schoolHtml}
</article>
${ctaBand(null, 2)}</div>`;
  write(`${r.slug}/${d.slug}/index.html`, shell({
    title: `${d.name} 초중고 학원 | ${BRAND} 지점 ${d.branches.length}곳`,
    desc: `${r.name} ${d.name}의 ${BRAND} 지점 안내. ${d.branches.map((b) => b.name).join(', ')}. 관리 학교 ${schoolsHere.length}곳의 내신 대비.`,
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
  const gradeRows = Object.entries(b.grades_by_subject || {}).filter(([, g]) => g).map(([s, g]) => `<tr><th>${esc(s)}</th><td>${esc(g)}</td></tr>`).join('');
  const faq = faqHtml([COPY.faqPool.common[0], COPY.faqPool.common[1], COPY.faqPool.common[2]], { tel: TEL, branchName: b.name });
  const levels = levelsOf(b);
  const gradeBlocks = levels.map((lv) => pick(COPY.gradeBlock[lv], key + lv)()).join('');
  const body = `<div class="wrap">
${crumb(3, [{ name: r.name, slug: r.slug }, { name: d.name, slug: d.slug }, { name: b.name }])}
<div class="page-head"><span class="tag">${esc(d.name)} ${esc(b.dong)}</span>${specBadge(b.name)}<h1>${BRAND} ${esc(b.name)}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
${bv ? '<h2>영상으로 보는 ' + esc(b.name) + '</h2>' + video(bv) : ''}
<h2>지점 안내</h2>
<div class="tbl-scroll"><table class="info-table">
<tr><th>주소</th><td>${esc(b.address)}${b.location_guide ? `<br><span style="color:var(--ink-soft);font-size:13.5px">${esc(b.location_guide).replace(/\n/g, '<br>')}</span>` : ''}</td></tr>
${nearbyRow(b)}
<tr><th>수업 과목</th><td>${esc((b.subjects || []).join(', '))}</td></tr>
${gradeRows}
<tr><th>수업 시간</th><td>${esc(b.open_time || '상담 시 안내')}${b.weekend ? ` · ${esc(b.weekend)}` : ''}</td></tr>
</table></div>
${classPhoto(3)}
${gradeBlocks}
<h2>과목별 수업 안내</h2>
<p>과목을 선택하면 ${esc(b.dong)} 기준의 수업 방식과 내신 대비 흐름을 자세히 볼 수 있습니다.</p>
<div class="chips">${subjectLinks}</div>
<h2>관리 학교</h2>
<p>${esc(b.name)}에 다니는 학생들의 소속 학교입니다. 학교별 시험 대비 안내는 학교 이름을 눌러 확인하세요.</p>
<div class="chips">${schoolChips}</div>
${faq.html}
</article>
${ctaBand(b, 3)}
<article class="body">${feeSection(b)}</article></div>`;
  write(`${r.slug}/${d.slug}/${b.branch_slug}/index.html`, shell({
    title: `${BRAND} ${b.name} | ${b.dong} 초중고 학원`,
    desc: `${b.region} ${b.district} ${b.dong}의 ${BRAND} ${b.name}. ${(b.subjects || []).join('·')} 수업, ${COPY.schoolLine(b)} 내신 관리. ${esc(b.open_time || '')}`,
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
function buildSubject(r, d, b, subj) {
  const slug = SUBJ_SLUG[subj];
  const key = `${b.branch_slug}/${slug}`;
  const ctx = { dong: b.dong, district: d.name, branchName: b.name, schoolShort: schoolShort(b), subject: subj };
  const lede = pick(COPY.ledeSubject[subj], key)(ctx);
  const methodHtml = pick(COPY.method[subj], key + 'm')(ctx);
  const levels = levelsOf(b);
  const gradeBlocks = levels.map((lv) => pick(COPY.gradeBlock[lv], key + lv)()).join('');
  const grades = (b.grades_by_subject || {})[subj];
  const bv = branchVideo(b); // 지점 매칭 영상이 있을 때만 노출
  const faq = faqHtml([COPY.faqPool.subject[0], COPY.faqPool.subject[1], COPY.faqPool.common[1]], { tel: TEL, branchName: b.name, schoolShort: ctx.schoolShort });
  const otherSubjects = (b.subjects || []).filter((s) => s !== subj).map((s) => `<a href="../${SUBJ_SLUG[s]}/">${esc(b.dong)} ${esc(s)}학원</a>`).join('');
  const body = `<div class="wrap">
${crumb(4, [{ name: r.name, slug: r.slug }, { name: d.name, slug: d.slug }, { name: b.name, slug: b.branch_slug }, { name: `${b.dong} ${subj}학원` }])}
<div class="page-head"><span class="tag">${esc(d.name)} ${esc(b.dong)}</span>${specBadge(b.name)}<h1>${esc(b.dong)} ${esc(subj)}학원 · ${esc(b.name)}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
<h2>${esc(subj)} 수업은 이렇게 진행합니다</h2>
${methodHtml}
${grades ? `<div class="note">${esc(b.name)} ${esc(subj)} 수업 대상: ${esc(grades)}</div>` : ''}
${gradeBlocks}
${bv ? '<h2>영상으로 보는 ' + esc(b.name) + '</h2>' + video(bv) : ''}
<h2>지점 정보</h2>
<div class="tbl-scroll"><table class="info-table">
<tr><th>지점</th><td><a href="../" style="color:var(--brick);font-weight:600">${BRAND} ${esc(b.name)}</a></td></tr>
<tr><th>주소</th><td>${esc(b.address)}</td></tr>
<tr><th>수업 시간</th><td>${esc(b.open_time || '상담 시 안내')}${b.weekend ? ` · ${esc(b.weekend)}` : ''}</td></tr>
</table></div>
${otherSubjects ? `<h2>${esc(b.dong)}의 다른 과목 수업</h2><div class="chips">${otherSubjects}</div>` : ''}
${guideLinks(SUBJ_GUIDES[subj], 4, subj + ' 공부법 칼럼')}
${faq.html}
</article>
${ctaBand(b, 4)}
<article class="body">${feeSection(b)}</article></div>`;
  write(`${r.slug}/${d.slug}/${b.branch_slug}/${slug}/index.html`, shell({
    title: `${b.dong} ${subj}학원 | ${BRAND} ${b.name}`,
    desc: `${b.district} ${b.dong} ${subj}학원 안내. ${BRAND} ${b.name}의 ${subj} 수업 방식과 학년별 커리큘럼, ${ctx.schoolShort} 내신 대비.`,
    canonical: `${DOMAIN}/${r.slug}/${d.slug}/${b.branch_slug}/${slug}/`, body, depth: 4,
    ld: faq.ld,
    footExtra: b.reg ? `${esc(b.office || BRAND + ' ' + b.name)} · 등록번호 ${esc(b.reg)}` : '',
  }));
}

// ── 학교 페이지 ──
function buildSchool(s) {
  const key = `${s.region_slug}/${s.district_slug}/${s.name}`;
  const b0 = s.branches[0];
  const lede = pick(COPY.schoolLede[s.level], key)(s.name, b0.name, b0.dong);
  const bodyBlock = pick(COPY.schoolBody[s.level], key + 'b')(s.name);
  const bv = branchVideo(b0); // 해당 지점의 매칭 영상이 있을 때만 노출
  const faq = faqHtml([COPY.faqPool.school[0], COPY.faqPool.school[1], COPY.faqPool.common[0]], { tel: TEL, school: s.name });
  // 나이스 학교기본정보 (수집된 학교만)
  const info = SCHOOL_INFO[`${s.region}|${s.district}|${s.name}`];
  const infoHtml = info ? `<h2>${esc(s.name)} 학교 정보</h2>
<p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">나이스 교육정보 개방 포털의 학교 기본 정보입니다.</p>
<div class="tbl-scroll"><table class="info-table">
<tr><th>정식 명칭</th><td>${esc(info.full)}${info.kind ? ` (${esc(info.kind)})` : ''}</td></tr>
${info.found ? `<tr><th>설립 구분</th><td>${esc(info.found)}</td></tr>` : ''}
${info.coedu ? `<tr><th>남녀공학</th><td>${esc(info.coedu)}</td></tr>` : ''}
${info.hstype ? `<tr><th>고교 유형</th><td>${esc(info.hstype)}</td></tr>` : ''}
${info.addr ? `<tr><th>주소</th><td>${esc(info.addr)}</td></tr>` : ''}
${info.tel ? `<tr><th>전화</th><td>${esc(info.tel)}</td></tr>` : ''}
${info.home ? `<tr><th>홈페이지</th><td><a href="${esc(info.home.startsWith('http') ? info.home : 'http://' + info.home)}" target="_blank" rel="noopener nofollow" style="color:var(--brick)">${esc(info.home)}</a></td></tr>` : ''}
</table></div>` : '';
  const bRows = s.branches.map((b) => `<tr><th><a href="../../${b.branch_slug}/" style="color:var(--brick);font-weight:600">${esc(b.name)}</a></th><td>${esc(b.address)}<br><span style="color:var(--ink-soft);font-size:13.5px">${esc((b.subjects || []).join(' · '))} · ${esc(b.open_time || '')}</span></td></tr>`).join('');
  const lvName = s.level === '초' ? '초등학교' : s.level === '중' ? '중학교' : '고등학교';
  const body = `<div class="wrap">
${crumb(4, [{ name: s.region, slug: s.region_slug }, { name: s.district, slug: s.district_slug }, { name: s.name + ' 내신 학원' }])}
<div class="page-head"><span class="tag">${esc(s.district)} · ${lvName}</span><h1>${esc(s.name)} 내신 학원, ${BRAND}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
${infoHtml}
${bodyBlock}
<h2>${esc(s.name)} 학생이 다닐 수 있는 지점</h2>
<div class="tbl-scroll"><table class="info-table">${bRows}</table></div>
${(b0.subjects || []).length ? `<h2>${esc(s.name)} 재학생 수업 과목</h2><p>${esc(b0.name)}에서 ${esc(s.name)} 학생이 들을 수 있는 과목은 ${esc((b0.subjects || []).join(', '))}입니다. ${s.level === '초' ? '초등부는 교과 진도를 따라가면서 공부 습관과 기본기를 함께 관리합니다.' : s.level === '중' ? '평소에는 학교 진도 기준으로 수업하고, 시험 기간에는 ' + esc(s.name) + ' 범위에 맞춘 내신 대비로 전환됩니다. 수행평가 일정도 수업 계획에 반영합니다.' : '수업은 학교 진도와 동기화되며, 내신 4주 전부터 ' + esc(s.name) + ' 기출 유형 중심의 실전 대비로 바뀝니다. 과목별 수업 방식은 아래에서 확인할 수 있습니다.'}</p><div class="chips">${(b0.subjects || []).filter((su) => SUBJ_SLUG[su]).map((su) => `<a href="../../${b0.branch_slug}/${SUBJ_SLUG[su]}/">${esc(b0.dong)} ${esc(su)}학원</a>`).join('')}</div>` : ''}
${bv ? '<h2>영상으로 보는 ' + esc(b0.name) + '</h2>' + video(bv) : ''}
${guideLinks(LEVEL_GUIDES[s.level], 4)}
${faq.html}
</article>
${ctaBand(b0, 4)}</div>`;
  write(`${s.region_slug}/${s.district_slug}/school/${s.name}/index.html`, shell({
    title: `${s.name} 내신 학원 | ${s.district} ${BRAND}`,
    desc: `${s.name} 재학생을 위한 내신 대비 안내. ${s.district} ${BRAND} ${s.branches.map((b) => b.name).join(', ')}에서 ${s.name} 진도와 기출 기준으로 시험을 준비합니다.`,
    canonical: `${DOMAIN}/${s.region_slug}/${s.district_slug}/school/${encodeURIComponent(s.name)}/`, body, depth: 4,
    ld: faq.ld,
  }));
}

// ── 공부법 칼럼 ──
const GUIDE_CATS = ['공부 습관', '내신 대비', '과목별 공부법', '학년별 가이드', '입시와 생기부'];
function buildGuideIndex() {
  const sections = GUIDE_CATS.map((cat) => {
    const items = GUIDES.filter((g) => g.cat === cat);
    return `<h2>${cat}</h2><div class="list-grid">${items.map((g) => `<a href="./${g.slug}/">${esc(g.title)}<span class="cnt">${esc(g.desc)}</span></a>`).join('')}</div>`;
  }).join('');
  const body = `<div class="wrap">
${crumb(1, [{ name: '공부법 칼럼' }])}
<div class="page-head"><h1>공부법 칼럼</h1><div class="sub">학원에서 학생들을 가르치며 정리한 공부 방법입니다. 학년과 과목에 맞는 글부터 읽어 보세요. 총 ${GUIDES.length}편.</div></div>
<article class="body">${sections}</article>
${ctaBand(null, 1)}</div>`;
  write('guide/index.html', shell({
    title: `공부법 칼럼 | ${BRAND}`,
    desc: `공부 습관, 내신 대비, 과목별 공부법, 학년별 가이드, 입시와 생기부 — ${BRAND}이 정리한 공부법 칼럼 ${GUIDES.length}편.`,
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
${g.video ? `<h2>관련 영상</h2>${video(g.video)}` : ''}
<h2>이 카테고리의 다른 글</h2>
<div class="chips">${related.map((r) => `<a href="../${r.slug}/">${esc(r.title)}</a>`).join('')}${others ? `<a href="../${others.slug}/">${esc(others.title)}</a>` : ''}</div>
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
  const REVIEWS = fs.existsSync(path.join(__dirname, 'data', 'reviews.json')) ? require('./data/reviews.json') : [];
  const cards = REVIEWS.map((r) => `<div class="rev"><div class="stars">★★★★★</div><div class="rtags"><span>${esc(r.gradeLabel)}</span><span>${esc(r.subject)}</span></div><p>${esc(r.text)}</p><div class="who">${esc(r.author)} · ${esc(r.meta)}</div></div>`).join('');
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
    desc: `${BRAND}에 다닌 학생과 학부모의 수강후기 ${REVIEWS.length}건. 내신, 자기주도학습, 과목별 성적 변화 경험담.`,
    canonical: `${DOMAIN}/review/`, body, depth: 1,
  }));
}

// ── 상담 신청 ──
function buildInquiry() {
  const body = `<div class="wrap">
${crumb(1, [{ name: '상담 신청' }])}
<div class="page-head"><h1>상담 신청</h1><div class="sub">아래 내용을 남겨 주시면 해당 지점에서 연락드립니다. 전화가 편하시면 <a href="tel:${TEL}" style="color:var(--brick);font-weight:700">전화 상담</a>을 눌러 주세요.</div></div>
<div class="form-card">
<form id="f">
<label>지점 (모르시면 지역만 적어 주세요)</label><input name="지점" id="fBranch" placeholder="예: 산본점 또는 군포시">
<label>학생 이름</label><input name="이름" required placeholder="이름">
<label>연락처</label><input name="연락처" required placeholder="010-0000-0000" inputmode="tel">
<label>학교 / 학년</label><input name="학년" placeholder="예: 덕풍중 2학년">
<label>희망 과목</label>
<div class="subj-row"><label><input type="checkbox" name="과목" value="국어">국어</label><label><input type="checkbox" name="과목" value="영어">영어</label><label><input type="checkbox" name="과목" value="수학">수학</label><label><input type="checkbox" name="과목" value="사회">사회</label><label><input type="checkbox" name="과목" value="과학">과학</label></div>
<label>연락받기 편한 시간</label><input name="연락희망시간" placeholder="예: 평일 오후">
<button type="submit">상담 신청하기</button>
</form>
<div class="form-ok" id="ok"><div class="big">신청이 접수되었습니다</div><p>확인 후 순서대로 연락드리겠습니다.</p></div>
</div></div>
<script>
(function(){
  var p=new URLSearchParams(location.search).get('지점');
  if(p)document.getElementById('fBranch').value=p;
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var f=e.target,btn=f.querySelector('button');
    var subj=Array.from(f.querySelectorAll('[name="과목"]:checked')).map(function(x){return x.value}).join(', ');
    if(!subj){alert('희망 과목을 1개 이상 선택해 주세요.');return;}
    btn.disabled=true;btn.textContent='전송 중...';
    var data={지점:f.지점.value||'일반문의(와와학습학원)',이름:f.이름.value,연락처:f.연락처.value,학년:f.학년.value,과목:subj,연락희망시간:f.연락희망시간.value,신청일:new Date().toLocaleString('ko-KR'),유입페이지:location.href,유입페이지제목:document.title,유입경로:document.referrer||'직접입력'};
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

// ── 실행 ──
buildHome();
buildInquiry();
buildGuideIndex();
for (const g of GUIDES) buildGuide(g);
buildReview();
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

// sitemap / robots / CNAME / favicon
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `<url><loc>${DOMAIN}/${encodeURI(u)}</loc></url>`).join('\n') + '\n</urlset>', 'utf8');
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`, 'utf8');
fs.writeFileSync(path.join(ROOT, 'CNAME'), 'wstudycenter.com\n', 'utf8');
fs.writeFileSync(path.join(ROOT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#22314e"/><text x="32" y="44" font-size="34" font-weight="800" text-anchor="middle" fill="#f0b58f" font-family="sans-serif">W</text></svg>`, 'utf8');
console.log('생성 완료:', urls.length, '페이지');
