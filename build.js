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
const GAS = 'https://script.google.com/macros/s/AKfycbybsuTZMjzlp3HkkVaUX0IUFnNlSfnnN0DGThb-2BOIwZ8IyZNnMgkwoWOb_muHCEx5/exec';
const TRACKER = '<script defer src="https://xn--vb0by3y5wigqb.com/t.js" data-site="wstudy"></script>';
const PROTECT = `<!-- WAWA_AUTO_PROTECT_START -->
<script>
(function(){
  // 우클릭 차단 (폼 입력칸은 허용 — 붙여넣기 등 정상 사용 보존)
  document.addEventListener('contextmenu', function(e){
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  }, false);
  // F12 / 개발자도구·소스보기 단축키 차단
  document.addEventListener('keydown', function(e){
    var k = e.keyCode || e.which;
    if (k === 123) { e.preventDefault(); return false; }                                      // F12
    if (e.ctrlKey && e.shiftKey && (k === 73 || k === 74 || k === 67)) { e.preventDefault(); return false; } // Ctrl+Shift+I/J/C
    if (e.ctrlKey && k === 85) { e.preventDefault(); return false; }                           // Ctrl+U (소스 보기)
  }, false);
  // 드래그·텍스트 선택 차단 (폼 입력칸은 허용)
  document.addEventListener('dragstart', function(e){ e.preventDefault(); });
  document.addEventListener('selectstart', function(e){
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  }, false);
})();
</script>
<style>body{-webkit-user-select:none;-moz-user-select:none;user-select:none}input,textarea,select{-webkit-user-select:text;-moz-user-select:text;user-select:text}img{-webkit-user-drag:none}</style>
<!-- WAWA_AUTO_PROTECT_END -->`;
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
function pageDates(seed) {
  let s = String(seed == null ? '' : seed);
  try { s = decodeURIComponent(s); } catch (e) {}
  s = '/' + s.replace(/^\/+/, ''); // '/busan/bukgu/' 형태로 정규화 (shell·sitemap이 같은 시드를 쓰도록)
  const h = seedHash(s);
  const h2 = seedHash('m:' + s);
  const published = new Date(SITE_LAUNCH_EPOCH + (h % LAUNCH_SPAN_DAYS) * 86400000);
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000); // KST 기준 오늘
  const y = nowKst.getUTCFullYear();
  const m = nowKst.getUTCMonth();
  const dayOff = h2 % 28;
  let modified = new Date(Date.UTC(y, m, 1 + dayOff));
  if (modified.getTime() > nowKst.getTime()) modified = new Date(Date.UTC(y, m - 1, 1 + dayOff));
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

// 수강료: wcoachingcenter.com과 동일한 회비 표 (와와회비A/B, 학년 × 주2·3·5회 월액)
const FEE_TABLES = {
  A: { 초등: ['160,000', '230,000', '370,000'], 중등: ['172,000', '247,000', '397,000'], 고등: ['195,000', '280,000', '450,000'] },
  B: { 초등: ['140,000', '200,000', '320,000'], 중등: ['152,000', '217,000', '347,000'], 고등: ['175,000', '250,000', '400,000'] },
};
function feeSection(b) {
  const t = FEE_TABLES[/A/.test(b.fee_type || '') ? 'A' : 'B'];
  const mins = { 초등: b.time_elem, 중등: b.time_mid, 고등: b.time_high };
  const hasMin = Object.values(mins).some((m) => parseInt(m, 10) > 20);
  const rows = Object.entries(t).map(([lv, p]) => {
    const m = parseInt(mins[lv], 10) > 20 ? `${parseInt(mins[lv], 10)}분` : '상담 시 안내';
    return `<tr><th>${lv}</th>${hasMin ? `<td class="tm">${m}</td>` : ''}<td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td></tr>`;
  }).join('');
  const legal = b.office && b.reg
    ? `<div class="fee-legal"><span>${esc(b.office)} (${esc(b.reg)})</span>${b.fee_link ? `<a class="fee-doc" href="${esc(b.fee_link)}" target="_blank" rel="noopener">교습비 공시 자료</a>` : ''}</div>`
    : '';
  return `<h2 id="fee">수강료 안내</h2><p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">교육청 등록 기준 공시 금액(월, 원)입니다. 자세한 시간, 횟수는 상담 시 조율합니다.</p>
<div class="tbl-scroll"><table class="info-table fee-table"><thead><tr><th>학년</th>${hasMin ? '<th class="tm">1회 수업</th>' : ''}<th>주2회</th><th>주3회</th><th>주5회</th></tr></thead><tbody>${rows}</tbody></table></div>${legal}`;
}
// 학교 페이지용: 해당 학교 학년(초/중/고)에 맞춘 지점별 수업비
function schoolFeeSection(s) {
  const lv = s.level === '초' ? '초등' : s.level === '중' ? '중등' : '고등';
  const minKey = { 초등: 'time_elem', 중등: 'time_mid', 고등: 'time_high' }[lv];
  const many = s.branches.length > 1;
  const rows = s.branches.map((b) => {
    const p = FEE_TABLES[/A/.test(b.fee_type || '') ? 'A' : 'B'][lv];
    const mm = parseInt(b[minKey], 10);
    const m = mm > 20 ? `${mm}분` : '상담 시 안내';
    return `<tr><th><a href="../../${b.branch_slug}/#fee" style="color:var(--brick);font-weight:600">${esc(b.name)}</a></th><td class="tm">${m}</td><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td></tr>`;
  }).join('');
  return `<h2 id="fee">${esc(s.name)} 학생 수업비 안내</h2><p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">${lv}부 기준, 교육청 등록 공시 금액(월, 원)입니다. ${many ? '지점에 따라 회비와 수업시간이 다를 수 있으니 지점명을 눌러 확인하세요.' : '자세한 시간, 횟수는 상담 시 조율합니다.'}</p>
<div class="tbl-scroll"><table class="info-table fee-table"><thead><tr><th>지점</th><th>1회 수업</th><th>주2회</th><th>주3회</th><th>주5회</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
  b.address = cleanTxt(b.address);
  if (b.location_guide) b.location_guide = String(b.location_guide).split(/\n+/).map(cleanTxt).filter(Boolean).join('\n');
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
function shell({ title, desc, canonical, body, depth, ld, ogTitle, footExtra, branch = '' }) {
  // 지점 페이지에서는 모든 상담 CTA 가 해당 지점을 달고 이동한다
  const cq = branch ? `?지점=${encodeURIComponent(branch)}` : '';
  const base = depth ? '../'.repeat(depth) : './';
  // 페이지 LD + 브레드크럼 LD 병합 (@graph)
  const graph = [];
  if (ld) { if (ld['@graph']) graph.push(...ld['@graph']); else { const o = { ...ld }; delete o['@context']; graph.push(o); } }
  if (CRUMB_LD) { graph.push(CRUMB_LD); CRUMB_LD = null; }
  // 페이지 날짜 (URL 시드·월 단위) — WebPage LD + article:*_time 메타 + 브레드크럼 옆 표시 문구
  const { datePublished, dateModified } = pageDates(canonical.replace(DOMAIN, ''));
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
<link rel="canonical" href="${canonical}">
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
<a href="tel:${TEL}">전화 상담</a> · <a href="${base}inquiry/${cq}">상담 신청</a> · <a href="${base}review/">수강후기</a><br>
학원 등록번호는 각 지점 페이지에 표기되어 있습니다. © ${BRAND}
<div style="margin-top:8px;font-size:12px;opacity:.8"><time datetime="${dateModified}">정보 업데이트 ${dateModified.replace(/-/g, '.')}</time></div>
${/assets\/(illust\/|wawa-class)/.test(body) ? '<div style="margin-top:8px;font-size:11px;opacity:.75">사진 출처: 와와학습코칭센터, AI로 이미지 생성</div>' : ''}
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
<script>document.documentElement.classList.add('js');(function(){var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('rv-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'}):null;document.querySelectorAll('.rv,.st').forEach(function(el){io?io.observe(el):el.classList.add('rv-in')});var hd=document.querySelector('header.site');if(hd){var t=false;window.addEventListener('scroll',function(){var s=window.scrollY>8;if(s!==t){t=s;hd.classList.toggle('hd-s',s)}},{passive:true})}var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;document.querySelectorAll('.blk-h').forEach(function(h){h.addEventListener('click',function(){if(window.innerWidth>=768)return;h.parentNode.classList.toggle('blk-open')})});document.querySelectorAll('.hero .stats .n').forEach(function(el){var m=el.textContent.match(/^([d,]+)(.*)$/);if(!m||rm)return;var to=parseInt(m[1].replace(/,/g,''),10),suf=m[2],t0=null,dur=1400;function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/dur);p=1-Math.pow(1-p,3);el.textContent=Math.round(to*p).toLocaleString()+suf;if(p<1)requestAnimationFrame(step)}el.textContent='0'+suf;setTimeout(function(){requestAnimationFrame(step)},650)})})();</script>
${PROTECT}
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
function video(v, cap) {
  if (!v) return '';
  const vert = !!v.shorts;
  const thumbs = vert ? ['oardefault', 'hqdefault'] : ['hq720', 'sddefault', 'hqdefault'];
  return `<div class="video-box"><div class="frame${vert ? ' vertical' : ''}" data-yt="${v.id}" data-title="${esc(v.title)}"><img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/${thumbs[0]}.jpg" data-fb="${thumbs.slice(1).join(',')}" alt="${esc(v.title)}" width="${vert ? 300 : 1280}" height="${vert ? 533 : 720}"><button type="button" class="yt-play" aria-label="${esc(v.title)} 재생"><span></span></button></div><div class="cap">▶ ${esc(cap || v.title)} (와와 공식 유튜브)</div></div>`;
}
function ctaBand(b, depth) {
  const base = '../'.repeat(depth);
  const q = b ? '?지점=' + encodeURIComponent(b.name) : '';
  // 카카오 '장소' 링크는 등록업체 페이지로 연결돼 센터 대표번호가 노출된다.
  // 좌표 길찾기로만 보낸다 (2026-08-20). 되돌리지 말 것.
  const _road = (a) => {
    const t = String(a || '').trim();
    const m = t.match(/^(.*(?:로|길)\s*\d+(?:-\d+)?)(?=\s|$)/);
    return m ? m[1].trim() : t.replace(/\s*(제?\S*\d+호|\S*\d+층)\b.*$/, '').replace(/\s*와와\S*$/, '').replace(/\s+\d+$/, '').trim();
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
  return `<div class="photo"><img loading="lazy" src="${'../'.repeat(depth)}assets/${f}" alt="와와 교실 공간 일러스트" width="900" height="664"><div class="cap">${pick(PHOTO_CAPS, key + 'cap')}</div></div>`;
}
// 수업 방식 강조 블록 — 큰 글씨 선언 + 원칙 3개 (2026-09-07 지시: 자기주도·개별진도·강의식 없음·학습코칭 강조)
// 같은 문장이 2,300페이지에 반복되면 페이지 간 유사도가 오르므로 슬롯별 변형을 페이지 키 해시로 고른다.
const WAY_L1 = [
  '강의식 수업이 아닙니다.<br>학생마다 자기 진도로 공부합니다.',
  '칠판 강의가 없습니다.<br>학생은 각자 자기 교재를 풉니다.',
  '설명을 듣는 수업이 아니라<br>직접 푸는 수업입니다.',
  '진도는 학생마다 다르고,<br>선생님은 옆에서 봐 줍니다.',
];
const WAY_L2 = [
  '선생님이 칠판 앞에서 진도를 나가고 받아 적는 방식이 아니라, 학생이 <em>자기 교재를 직접 풀고</em> 선생님이 <em>옆에서 봐 주는</em> 방식입니다. <em>공부 방법과 습관</em>도 같이 잡아 줍니다.',
  '진단으로 정한 <em>자기 진도</em>를 각자 나가고, 막히는 곳은 선생님이 <em>그 자리에서</em> 설명해 줍니다. 계획 짜기와 오답 정리 같은 <em>공부 습관</em>도 수업 안에서 챙깁니다.',
  '같은 교실에 있어도 학생마다 <em>교재와 단원이 다릅니다</em>. 선생님은 앞에서 설명하는 대신 <em>학생 옆에서</em> 확인하고, <em>공부하는 방법</em>까지 같이 잡아 줍니다.',
  '칠판에 쓰고 받아 적는 시간이 없습니다. 수업 시간은 학생이 <em>직접 푸는 시간</em>이고, 선생님은 <em>막힌 곳을 개별로</em> 설명합니다. <em>공부 습관</em>은 매 수업 확인하면서 잡습니다.',
];
const WAY_CARDS = [
  { t: ['개별 진도', '학생마다 다른 진도', '자기 진도 수업', '진단 후 개별 진도'], d: [
    '처음에 진단을 해서 어디서부터 할지 정합니다. 교재, 단원, 주당 횟수가 학생마다 다르고, 학기 중간에 와도 그 자리에서 시작하면 됩니다.',
    '등록하면 먼저 진단부터 합니다. 그 결과로 교재와 시작 단원을 정하기 때문에 학생마다 진도가 다르고, 개강일을 기다릴 필요도 없습니다.',
    '정해진 반 진도가 없습니다. 학생의 현재 위치에서 시작해 자기 속도로 나가고, 주당 횟수와 교재도 상담에서 학생에 맞춰 정합니다.',
    '이전 학년에서 빠진 단원이 있으면 거기서부터, 여유가 있으면 상담 후 앞 단원까지 나갑니다. 시작점과 속도가 학생마다 다른 이유입니다.',
  ] },
  { t: ['칠판·판서 수업 없음', '강의식 수업 없음', '판서 수업 없음', '강의 대신 직접 풀기'], d: [
    '앞에서 설명하고 받아 적는 시간이 없습니다. 학생이 푸는 동안 선생님이 옆에서 보고, 막히면 그 자리에서 설명해 줍니다.',
    '선생님이 칠판에 쓰고 학생이 옮겨 적는 수업을 하지 않습니다. 수업 시간 대부분은 학생이 직접 푸는 시간이고, 선생님은 옆에서 확인합니다.',
    '설명을 들을 때는 아는 것 같다가도 혼자 풀면 막히는 경우가 많습니다. 그래서 설명은 막힌 학생에게 개별로 하고, 나머지 시간은 직접 풀게 합니다.',
    '진도를 일괄로 나가는 강의가 없으니 이해하지 못한 채 넘어가는 일이 없습니다. 한 문제를 붙잡고 있으면 선생님이 와서 같이 풉니다.',
  ] },
  { t: ['학습코칭', '공부 방법과 습관', '공부 습관 관리', '코칭이 붙는 수업'], d: [
    '계획 짜기, 오답 정리, 그날 분량 확인까지 선생님이 챙깁니다. 혼자 두는 자습이 아니라, 스스로 공부하는 습관을 들이는 과정입니다.',
    '과목 수업에 공부 방법 지도가 같이 붙습니다. 오늘 할 분량을 정하고, 틀린 문제를 정리하고, 다음 수업 전까지 할 일을 확인하는 것을 매번 반복합니다.',
    '성적은 공부 습관에서 갈립니다. 계획을 세우고 지키는 것, 오답을 다시 보는 것을 선생님이 매 수업 확인하면서 습관으로 만듭니다.',
    '무엇을 얼마나 할지 학생이 정하고 선생님이 확인합니다. 처음에는 선생님이 잡아 주지만, 학년이 올라갈수록 학생이 스스로 계획하는 쪽으로 넘깁니다.',
  ] },
];
function wayBlock(compact = false, key = 'home') {
  const cards = WAY_CARDS.map((c, i) => `<div class="w"><div class="n">0${i + 1}</div><div class="t">${pick(c.t, key + 'wt' + i)}</div><div class="d">${pick(c.d, key + 'wd' + i)}</div></div>`).join('\n');
  return `<div class="say${compact ? ' compact' : ''}">
<div class="k">수업 방식</div>
<div class="l1">${pick(WAY_L1, key + 'l1')}</div>
<div class="l2">${pick(WAY_L2, key + 'l2')}</div>
</div>
<div class="way">
${cards}
</div>`;
}
const LEVEL_GUIDES = {
  초: ['elem-habit', 'pre-middle', 'study-planner'],
  중: ['exam-4weeks', 'performance-assessment', 'wrong-note'],
  고: ['high1-first-exam', 'saenggibu-setek', 'high23-balance'],
};

// 지점명이 정확히 일치할 때만 지점 영상 (다른 지점 영상이 섞이면 혼란 — 2026-07-14 지시)
function branchVideo(b) {
  return VIDEOS.branch[b.name] || null;
}
// 초·중·고 안내 블록 기준 = 과목별 수업 학년(grades_by_subject). 학교 목록은 보조.
// (2026-09-08 수정: 학교 목록만 보면 동춘점처럼 고등학교만 등록된 42곳이 고등부만 나왔다)
// 지점 페이지 본문을 h2 단위 섹션(.blk)으로 나눈다. 모바일에서는 openTitles 외 섹션을 접어 두고 제목을 누르면 펼친다(스크립트는 shell에).
function sectionize(html, closedTitles = []) {
  const parts = html.split(/(?=<h2\b)/);
  return parts.map((p) => {
    const m = p.match(/^<h2([^>]*)>([\s\S]*?)<\/h2>([\s\S]*)$/);
    if (!m) return p;
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    const open = !closedTitles.some((t) => t instanceof RegExp ? t.test(title) : title.startsWith(t));
    return `<section class="blk${open ? ' blk-open' : ''}"><h2 class="blk-h"${m[1]}>${m[2]}</h2><div class="blk-b">${m[3]}</div></section>`;
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
function schoolShort(b) {
  const mids = [...(b.schools_mid || []), ...(b.schools_high || [])];
  const arr = mids.length ? mids : (b.schools_elem || []);
  return arr.slice(0, 3).join('·') || b.dong + ' 인근 학교';
}

// ── 홈 ──
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
    { q: '학원을 다니는데 성적이 그대로예요', a: '원인은 대부분 학생 수준과 맞지 않는 일괄 강의입니다. 와와는 칠판 강의 없이 진단으로 시작점을 찾고, 학생마다 교재와 단원을 다르게 잡는 개별 진도로 수업합니다.' },
    { q: '혼자서는 책상에 앉지를 않아요', a: '의지의 문제가 아니라 틀의 문제입니다. 와와는 공부 방법과 습관을 잡는 학습코칭이 수업에 들어 있어서, 계획 확인과 테스트로 공부가 돌아가는 틀을 학원이 만들어 줍니다.' },
    { q: '우리 학교 시험 스타일을 아는 곳이 없어요', a: '지점마다 인근 학교 재학생이 다녀서 학교별 진도, 필기, 기출 정보가 매 학기 쌓입니다. 시험 3~4주 전부터 그 자료로 대비합니다.' },
    { q: '수행평가까지 챙겨 주는 곳이 필요해요', a: '학기 초 평가 계획을 확인해 두고, 제출물은 마감 전까지 학원 일정에서 관리합니다. 지필과 수행을 합쳐야 등급이 나오기 때문입니다.' },
  ];
  const STEPS = [
    ['진단 상담', '학교, 학년, 현재 성적을 보고 어느 단원부터 시작할지 정합니다.'],
    ['개별 진도 수업', '칠판 강의가 아니라 학생이 자기 교재를 풉니다. 교재와 단원이 학생마다 다르고, 막히면 선생님이 옆에서 설명해 줍니다.'],
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
    { q: '수업료는 어떻게 되나요?', a: '학년과 주당 횟수에 따라 다르며, 교육청 등록 기준 공시 금액을 각 지점 페이지의 수강료 안내 표에 그대로 올려 두었습니다. 자세한 시간과 횟수는 상담에서 조율합니다.' },
    { q: '우리 동네에도 지점이 있나요?', a: `전국에 ${total}개 지점이 있습니다. 지역별 지점 찾기에서 시·군·구를 선택하면 지점 위치와 관리 학교를 확인할 수 있습니다.` },
    { q: '다른 학원과 무엇이 다른가요?', a: '칠판·판서 강의가 없습니다. 진단 후 학생마다 교재와 단원을 다르게 잡는 개별 진도로 각자 공부하고, 과목 선생님이 옆에서 확인하며 공부 방법과 습관까지 코칭합니다. 시험 기간에는 학생이 다니는 학교의 기출과 수업 자료 기준으로 내신을 준비합니다.' },
    { q: '강의를 안 하면 학생이 혼자 공부하는 건가요?', a: '아닙니다. 과목 선생님이 소수 인원을 개별로 봐 주면서 막히는 부분을 바로 설명합니다. 계획 짜기, 오답 정리, 그날 분량 확인도 선생님이 챙기기 때문에 혼자 두는 자습과는 다릅니다.' },
    { q: '몇 학년부터 다닐 수 있나요?', a: '지점에 따라 초등 저학년부터 고3까지 받습니다. 각 지점 페이지의 과목별 대상 학년 표에서 확인할 수 있습니다.' },
  ];
  const faqLd = { '@type': 'FAQPage', mainEntity: HOME_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const body = `
<div class="hero w"><div class="in">
<div class="award">2025 소비자가 뽑은 올해의 대상 · 교육 부문 수상</div>
<h1>칠판 강의 없이<br><em>자기 진도로 공부하는</em> 학원</h1>
<p>${BRAND}은 전국 ${total}개 지점이 있는 초·중·고 교과 학원입니다. 학생마다 자기 진도로 공부하고 선생님이 옆에서 봐 줍니다. 공부 방법과 습관도 같이 잡고, 시험 기간에는 학교 자료로 내신을 준비합니다.</p>
<div class="btns"><a class="b1" href="./inquiry/">상담 신청</a><a class="b2" href="#regions">가까운 지점 찾기</a></div>
<div class="stats"><div class="s"><div class="n">${total}</div><div class="k">전국 지점</div></div><div class="s"><div class="n">${totalSchools}</div><div class="k">관리 학교</div></div><div class="s"><div class="n">5과목</div><div class="k">국·영·수·사·과</div></div></div>
</div></div>

<section class="w-sec"><div class="in">
<div class="w-head rv"><div class="k">Why</div><h2>이런 고민으로<br>오시는 분들이 많습니다</h2><p>상담에서 실제로 가장 자주 듣는 이야기들입니다.</p></div>
<div class="w-rows st">${WORRIES.map((w) => `<div class="rv"><b>${esc(w.q)}</b><p>${esc(w.a)}</p></div>`).join('')}</div>
</div></section>

<section class="w-sec dark"><div class="in">
${wayBlock().replace('class="say"','class="say rv"').replace('class="way"','class="way st"')}
</div></section>

<section class="w-sec"><div class="in">
<div class="w-head rv"><div class="k">How</div><h2>수업은 이렇게 진행됩니다</h2><p>${total}개 지점이 같은 방식으로 운영됩니다.</p></div>
<div class="w-line st">${STEPS.map((s, i) => `<div><em>0${i + 1}</em><div><b>${esc(s[0])}</b><p>${esc(s[1])}</p></div></div>`).join('')}</div>
<article class="body" style="margin-top:40px">
<p>학원의 성과는 학생이 다니는 학교의 시험에서 확인됩니다. 그래서 와와학습학원의 커리큘럼은 학원 편의가 아니라 학교 기준입니다. 지점마다 인근 학교 재학생들이 다니기 때문에 학교별 진도와 시험 정보가 매 학기 쌓이고, 시험 기간이 되면 그 자료가 수업의 중심이 됩니다. 화려한 설명회 대신, 진단과 개별 진도와 매주 반복되는 확인으로 성적을 만드는 곳입니다. 수업 시간에 강의를 듣는 시간보다 직접 푸는 시간이 길고, 공부 방법과 습관은 선생님이 옆에서 잡아 줍니다.</p>
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
<a href="./guide/saenggibu-setek/"><b>고등부</b><p>내신, 수행, 생기부를 한 흐름으로 관리합니다. 수업에서 다룬 내용을 교과 세특 주제로 이어 줍니다. <span class="more">교과 세특 만들기 →</span></p></a>
</div>
</div></section>

<section class="w-sec"><div class="in">
<div class="w-head rv"><div class="k">Review</div><h2>다녀 본 학생과<br>학부모의 이야기</h2></div>
<div class="w-quote st">${REVIEWS.slice(0, 3).map((r) => `<div class="rv"><div class="stars">★★★★★</div><p>${esc(r.text.length > 100 ? r.text.slice(0, 100) + '…' : r.text)}</p><div class="who">${esc(r.author)} · ${esc(r.meta)} · ${esc(r.gradeLabel)} ${esc(r.subject)}</div></div>`).join('')}</div>
<div class="more-link rv"><a href="./review/">수강후기 전체 보기 →</a></div>
</div></section>

<section class="w-sec soft" id="regions"><div class="in">
<div class="w-head rv"><div class="k">Where</div><h2>지역별 지점 찾기</h2><p>지점명, 동네, 학교 이름으로 검색하거나 지도에서 지역을 선택하세요.</p></div>
<div class="sbox"><input id="q" type="search" placeholder="지점·동네·학교 검색 (예: 산본점, 덕풍동, 산본중)" autocomplete="off" aria-label="지점 검색"><div id="sres" class="sres"></div></div>
<div class="kmap st">${kmapHtml}</div>
</div></section>

<section class="w-sec"><div class="in">
${video(VIDEOS.pools.brand[0])}
${video(VIDEOS.pools.interview[0], '합격 인터뷰: 평택 와와에서 서울대 합격생이 나온 이유')}
<p style="font-size:14px;color:var(--ink-soft)">더 많은 영상은 <a href="https://www.youtube.com/@wawacoachingcenter" target="_blank" rel="noopener" style="color:var(--brick);font-weight:600">유튜브 채널</a>에서 볼 수 있습니다.</p>
<div class="w-head rv" style="margin-top:72px"><div class="k">FAQ</div><h2>자주 묻는 질문</h2></div>
<div class="faq st">${HOME_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
</div></section>

<section class="w-cta"><div class="in"><h2 class="rv">학생의 학교와 학년만 알려 주시면<br>어느 단원부터 시작할지 답해 드립니다</h2><p class="rv">가까운 지점에서 진단 상담 일정을 잡아 연락드립니다. 전화나 상담 신청 어느 쪽이든 괜찮습니다.</p><div class="btns rv"><a class="b1" href="./inquiry/">상담 신청</a><a class="b2" href="tel:${TEL}">전화 상담</a></div></div></section>
<script>
(function(){
  var q=document.getElementById('q'),res=document.getElementById('sres'),idx=null,loading=false;
  if(!q)return;
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function load(cb){
    if(idx){cb();return;}
    if(loading)return;
    loading=true;
    fetch('./assets/search-index.json').then(function(r){return r.json()}).then(function(d){idx=d;loading=false;cb();}).catch(function(){loading=false;});
  }
  function run(){
    var v=q.value.trim();
    if(!v){res.innerHTML='';res.classList.remove('on');return;}
    if(!idx){load(run);return;}
    var starts=[],inc=[];
    for(var i=0;i<idx.length&&starts.length<10;i++){
      var e=idx[i];
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
  write('index.html', shell({
    title: `${BRAND} | 전국 ${total}개 지점, 학교별 내신 전문 초중고 학원`,
    desc: `초·중·고 내신은 학교를 아는 학원에서. 전국 ${total}개 지점, ${totalSchools}개 학교의 진도·기출 기준 수업. 진단 후 개별 진도, 수행평가 관리, 수강료 공시. 2025 올해의 대상(교육 부문) 수상.`,
    canonical: DOMAIN + '/', body, depth: 0,
    ld: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'EducationalOrganization', name: BRAND, url: DOMAIN, telephone: TEL, description: '초중고 교과 수업과 학교별 내신 관리 전문 학원. 전국 지점 운영.', sameAs: ['https://www.youtube.com/@wawacoachingcenter'], award: '2025 소비자가 뽑은 올해의 대상 (교육 부문)' },
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
  const pts = [];
  for (const d of Object.values(r.districts)) for (const b of d.branches) {
    pts.push({ n: b.name, city: d.name, gu: guOf(b) || '', dong: b.dong || '', la: b.lat, lo: b.lng, u: `/${r.slug}/${d.slug}/${b.branch_slug}/` });
  }
  const body = `<div class="wrap">
${crumb(1, [{ name: r.name }])}
<div class="page-head"><span class="tag">지역 안내</span><h1>${esc(r.name)} ${BRAND} 지점</h1><div class="sub">${esc(r.name)}에는 ${n}개 지점이 있습니다. 지도의 마커를 누르거나 시·군·구를 선택하면 지점별 과목과 관리 학교를 볼 수 있습니다.</div></div>
<article class="body">${branchesMap(pts, ['city', 'gu', 'dong'])}<h2>시·군·구별 지점</h2><div class="list-grid">${cards}</div></article>
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
${(() => {
  const dpts = d.branches.map((b) => ({ n: b.name, gu: guOf(b) || '', dong: b.dong || '', la: b.lat, lo: b.lng, u: `/${r.slug}/${d.slug}/${b.branch_slug}/` }));
  const gus = new Set(dpts.map((p) => p.gu).filter(Boolean));
  const dongs = new Set(dpts.map((p) => p.dong).filter(Boolean));
  const lv = gus.size >= 2 ? ['gu', 'dong'] : (dongs.size >= 3 ? ['dong'] : []);
  return branchesMap(dpts, lv);
})()}
<h2>${esc(d.name)} 지점</h2><div class="list-grid">${bCards}</div>
<h2>관리 학교별 안내</h2>
<p>학교 이름을 선택하면 그 학교 재학생을 위한 내신 대비 안내 페이지로 이동합니다. 목록에 없는 인근 학교 학생도 수업이 가능합니다.</p>
${schoolHtml}
</article>
${ctaBand(null, 2)}</div>`;
  write(`${r.slug}/${d.slug}/index.html`, shell({
    title: `${r.name} ${d.name} 초중고 학원 | ${BRAND} 지점 ${d.branches.length}곳`,
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
  const subjPills = (b.subjects || []).map((sj) => { const g = (b.grades_by_subject || {})[sj]; return `<span class="sp">${esc(sj)}${g ? `<em>${esc(gradeRange(g))}</em>` : ''}</span>`; }).join('');
  const faq = faqHtml([COPY.faqPool.common[3], COPY.faqPool.common[0], COPY.faqPool.common[1], COPY.faqPool.common[2]], { tel: TEL, branchName: b.name });
  const levels = levelsOf(b);
  const gradeBlocks = levels.map((lv) => pick(COPY.gradeBlock[lv], key + lv)()).join('');
  const body = `<div class="wrap">
${crumb(3, [{ name: r.name, slug: r.slug }, { name: d.name, slug: d.slug }, { name: b.name }])}
<div class="bh"><div class="page-head"><span class="tag">${esc(d.name)} ${esc(b.dong)}</span>${specBadge(b.name)}<h1>${BRAND} ${esc(b.name)}</h1><div class="sub">${esc(lede)}</div></div>
${classPhoto(3, b.branch_slug)}</div>
<article class="body">
${wayBlock(false, b.branch_slug)}
${sectionize(`<h2>지점 안내</h2>
<div class="tbl-scroll"><table class="info-table">
<tr><th>주소</th><td>${esc(b.address)}${b.location_guide ? `<br><span style="color:var(--ink-soft);font-size:13.5px">${esc(b.location_guide).replace(/\n/g, '<br>')}</span>` : ''}</td></tr>
${nearbyRow(b)}
<tr><th>수업 과목</th><td><div class="sp-row">${subjPills}</div></td></tr>
<tr><th>수업 시간</th><td>${esc(b.open_time || '상담 시 안내')}${b.weekend ? ` · ${esc(b.weekend)}` : ''}<br><span class="td-sub">${pick(['상담 예약제 · 셔틀버스 없음 · 수업비는 아래 <a href="#fee">수강료 안내</a> 참고', '방문 상담은 예약 후 · 셔틀 운행 없음 · 수업비는 <a href="#fee">수강료 안내</a>에서 확인', '상담은 미리 예약 · 셔틀버스 운영 안 함 · 금액은 아래 <a href="#fee">수강료 표</a> 참고'], key + 'ops')}</span></td></tr>
</table></div>
${osmMap(b)}
${pick(COPY.wawaWay, b.branch_slug + 'way')(b.subjects)}
${gradeBlocks}
<h2>과목별 수업 안내</h2>
<p>${pick([`과목을 선택하면 ${esc(b.dong)} 기준의 수업 방식과 내신 대비 흐름을 자세히 볼 수 있습니다.`, `${esc(b.dong)}에서 듣는 과목별 수업 내용과 시험 대비 방식은 과목 이름을 누르면 볼 수 있습니다.`, `아래 과목을 누르면 ${esc(b.name)}의 과목별 수업 순서와 내신 준비 방법을 확인할 수 있습니다.`], key + 'subp')}</p>
<div class="chips">${subjectLinks}</div>
<h2>관리 학교</h2>
<p>${pick([`${esc(b.name)}에 다니는 학생들의 소속 학교입니다. 학교별 시험 대비 안내는 학교 이름을 눌러 확인하세요. <strong>목록에 없는 인근 학교 학생도 수업이 가능하니</strong> 상담에서 확인해 주세요.`, `${esc(b.name)} 학생들이 다니는 학교입니다. 학교 이름을 누르면 그 학교 기준의 시험 대비 안내가 나옵니다. <strong>목록에 없는 학교도 인근이면 수업할 수 있으니</strong> 상담 때 말씀해 주세요.`, `현재 ${esc(b.name)}에 다니는 학생들의 학교 목록입니다. 학교별 시험 준비 방법은 이름을 눌러 보세요. <strong>여기 없는 학교 학생도 상담 후 수업이 가능합니다.</strong>`], key + 'schp')}</p>
<div class="chips">${schoolChips}</div>
${bv ? video(bv) : video(pick(VIDEOS.pools.brand, b.branch_slug + 'promo'), pick(['와와 소개 영상', '와와학습학원 소개 영상', '와와 공식 채널의 소개 영상'], b.branch_slug + 'vcap'))}
${faq.html}`, ['와와의 수업 방식', '수업 운영 원칙', '자주 묻는 질문', /학생|내신|재학생|공부 습관/])}
</article>
${ctaBand(b, 3)}
<article class="body">${sectionize(feeSection(b), [])}</article></div>`;
  write(`${r.slug}/${d.slug}/${b.branch_slug}/index.html`, shell({
    branch: b.name,
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
  const faq = faqHtml([COPY.faqPool.subject[0], COPY.faqPool.subject[1], COPY.faqPool.common[3], COPY.faqPool.common[1]], { tel: TEL, branchName: b.name, schoolShort: ctx.schoolShort, subject: subj });
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
${bv ? video(bv) : ''}
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
    branch: b.name,
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
  // 나이스 학교기본정보 — 표 대신 본문 첫 문장으로 (설립·공학·유형만, 2026-07-14 지시)
  const info = SCHOOL_INFO[`${s.region}|${s.district}|${s.name}`];
  let infoHtml = '';
  if (info && info.full) {
    const coedu = info.coedu === '남' ? '남학교' : info.coedu === '여' ? '여학교' : info.coedu ? '남녀공학' : '';
    const kind = info.hstype || info.kind || '';
    const parts = [info.found, coedu, kind].filter(Boolean).join(' ');
    if (parts) infoHtml = `<p>${esc(info.full)}는 ${esc(s.region)} ${esc(s.district)}에 있는 ${esc(parts)}입니다.</p>`;
  }
  // 학사일정 위젯 (나이스 코드 확보된 학교만 — myschool 워커 API 경유, 24h 캐시)
  const schedCode = SCHOOL_CODES[`${s.region}|${s.district}|${s.name}`] || null;
  // 학교→지점 거리 (지오코딩 성공 + 8km 이내일 때만 — 좌표 오매칭 방지)
  const geo = SCHOOL_GEO[`${s.region}|${s.district}|${s.name}`];
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
    return `<tr><th><a href="../../${b.branch_slug}/" style="color:var(--brick);font-weight:600">${esc(b.name)}</a></th><td>${dist}${esc(b.address)}<br><span style="color:var(--ink-soft);font-size:13.5px">${esc((b.subjects || []).join(' · '))} · ${esc(b.open_time || '')}</span></td></tr>`;
  }).join('');
  const lvName = s.level === '초' ? '초등학교' : s.level === '중' ? '중학교' : '고등학교';
  const body = `<div class="wrap">
${crumb(4, [{ name: s.region, slug: s.region_slug }, { name: s.district, slug: s.district_slug }, { name: s.name + ' 내신 학원' }])}
<div class="page-head"><span class="tag">${esc(s.district)} · ${lvName}</span><h1>${esc(s.name)} 내신 학원, ${BRAND}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
${infoHtml}
${schedCode ? `<div id="sched" data-code="${esc(schedCode)}" data-school="${esc(s.name)}"></div>
<script>
(function(){
  var el=document.getElementById('sched');if(!el)return;
  function h(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  fetch('https://xn--vb0b6fp35b6njbws.com/api/schedule?code='+encodeURIComponent(el.getAttribute('data-code')))
    .then(function(r){return r.json()})
    .then(function(ev){
      ev=(ev||[]).filter(function(e){return /방학|개학/.test(e.n)});
      if(!ev.length)return;
      function f(d){var dt=new Date(Date.UTC(+d.slice(0,4),+d.slice(4,6)-1,+d.slice(6,8)));var w=['일','월','화','수','목','금','토'][dt.getUTCDay()];return (+d.slice(4,6))+'.'+(+d.slice(6,8))+'('+w+')'}
      var rows=ev.map(function(e){
        return '<div class="ev"><span class="en">'+h(e.n)+'</span><span class="ed">'+f(e.start)+(e.end!==e.start?' ~ '+f(e.end):'')+'</span></div>'}).join('');
      el.innerHTML='<h2>'+h(el.getAttribute('data-school'))+' 방학·개학 일정</h2><div class="evs">'+rows+'</div><p class="ev-note">나이스 교육정보 기준이며, 학교 사정에 따라 바뀔 수 있습니다.</p>';
    }).catch(function(){});
})();
</script>` : ''}
${bodyBlock}
${pick(COPY.wawaWay, key + 'way')(['국어', '영어', '수학', '사회', '과학'].filter((x) => s.branches.some((br) => br.subjects.includes(x))))}
<h2>${esc(s.name)} 학생이 다닐 수 있는 지점</h2>
<div class="tbl-scroll"><table class="info-table">${bRows}</table></div>
${(() => {
  const mpts = s.branches.filter((b) => b.lat && b.lng).map((b) => ({ n: b.name, la: b.lat, lo: b.lng, u: `../../${b.branch_slug}/` }));
  const scOk = geo && s.branches.some((b) => b.lat && b.lng && distM(geo.lat, geo.lng, b.lat, b.lng) <= 8000);
  return branchesMap(mpts, [], scOk ? { n: s.name, la: geo.lat, lo: geo.lng } : null);
})()}
${(b0.subjects || []).length ? `<h2>${esc(s.name)} 재학생 수업 과목</h2><p>${esc(b0.name)}에서 ${esc(s.name)} 학생이 들을 수 있는 과목은 ${esc((b0.subjects || []).join(', '))}입니다. ${s.level === '초' ? '초등부는 교과 진도를 따라가면서 공부 습관과 기본기를 함께 관리합니다.' : s.level === '중' ? '평소에는 학교 진도 기준으로 수업하고, 시험 기간에는 ' + esc(s.name) + ' 범위에 맞춘 내신 대비로 전환됩니다. 수행평가 일정도 수업 계획에 반영합니다.' : '수업은 학교 진도와 동기화되며, 내신 4주 전부터 ' + esc(s.name) + ' 기출 유형 중심의 실전 대비로 바뀝니다. 과목별 수업 방식은 아래에서 확인할 수 있습니다.'}</p><div class="chips">${(b0.subjects || []).filter((su) => SUBJ_SLUG[su]).map((su) => `<a href="../../${b0.branch_slug}/${SUBJ_SLUG[su]}/">${esc(b0.dong)} ${esc(su)}학원</a>`).join('')}</div>` : ''}
${wayBlock(true, key)}
${bv ? video(bv) : video(pick(VIDEOS.pools.brand, key + 'promo'), pick(['와와 소개 영상', '와와학습학원 소개 영상', '와와 공식 채널의 소개 영상'], key + 'vcap'))}
${faq.html}
</article>
${ctaBand(b0, 4)}
<article class="body">
${guideLinks(LEVEL_GUIDES[s.level], 4)}
${schoolFeeSection(s)}
</article></div>`;
  write(`${s.region_slug}/${s.district_slug}/school/${s.name}/index.html`, shell({
    title: `${s.name} 내신 학원 | ${s.district} ${BRAND}`,
    desc: `${s.name} 재학생을 위한 내신 대비 안내. ${s.district} ${BRAND} ${s.branches.map((b) => b.name).join(', ')}에서 ${s.name} 진도와 기출 기준으로 시험을 준비합니다.`,
    canonical: `${DOMAIN}/${s.region_slug}/${s.district_slug}/school/${encodeURIComponent(s.name)}/`, body, depth: 4,
    ld: faq.ld,
  }));
}

// ── 공부법 칼럼 ──
const GUIDE_CATS = ['공부 습관', '내신 대비', '과목별 공부법', '학년별 가이드', '대학 준비와 생기부'];
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
    desc: `공부 습관, 내신 대비, 과목별 공부법, 학년별 가이드, 대학 준비와 생기부까지 ${BRAND}이 정리한 공부법 칼럼 ${GUIDES.length}편.`,
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
<div class="page-head"><h1>상담 신청</h1><div class="sub">상담은 예약제로 진행됩니다. 아래 내용을 남겨 주시면 해당 지점에서 시간을 잡아 연락드립니다. 전화가 편하시면 <a href="tel:${TEL}" style="color:var(--brick);font-weight:700">전화 상담</a>을 눌러 주세요.</div></div>
<div class="form-card">
<form id="f">
<label>지점 선택 <span style="font-weight:400;color:var(--ink-soft)">(모르시면 비워 두셔도 됩니다)</span></label>
<div class="sel-row">
<select id="fSido"><option value="">시/도</option>${Object.values(regions).map((r) => `<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('')}</select>
<select id="fGu" disabled><option value="">시/군/구</option></select>
</div>
<select name="지점" id="fBranch" disabled style="margin-top:6px"><option value="">지점 (시/군/구를 먼저 선택하세요)</option></select>
<label>학생 이름</label><input name="이름" required placeholder="이름">
<label>연락처</label><div style="display:flex;gap:6px"><select name="연락처앞" style="flex:0 0 44px;appearance:none;-webkit-appearance:none;text-align:center;text-align-last:center;padding:0"><option value="010" selected>010</option><option value="011">011</option><option value="016">016</option><option value="017">017</option><option value="018">018</option><option value="019">019</option></select><input name="연락처" required placeholder="1234-5678" inputmode="tel" style="flex:1;min-width:0"></div>
<label>주소 <span style="font-weight:400;color:var(--ink-soft)">(도로명까지만 적어 주세요)</span></label>
<div class="sel-row" style="align-items:stretch">
<input name="거주주소" id="fAddr" required readonly onclick="document.getElementById(&quot;addrBtn&quot;).click()" placeholder="주소 검색을 눌러 선택하세요" style="flex:1;min-width:0;cursor:pointer;background:#fff">
<button type="button" id="addrBtn" style="flex:0 0 auto;padding:0 14px;border:1.5px solid var(--brick);border-radius:8px;background:#fff;color:var(--brick);font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap">도로명 검색</button>
</div>
<label>학년</label>
<div class="sel-row">
<select name="학년급" id="fLv"><option value="">선택</option><option>초등</option><option>중등</option><option>고등</option><option>기타</option></select>
<select name="학년상세" id="fGrade" disabled><option value="">-</option></select>
</div>
<label>학교 이름 <span style="font-weight:400;color:var(--ink-soft)">(선택)</span></label><input name="학교" placeholder="예: 덕풍중" maxlength="30">
<label>희망 과목 <span style="font-weight:400;color:var(--ink-soft)">(누르면 선택됩니다)</span></label>
<div class="subj-pills">${['국어', '영어', '수학', '사회', '과학'].map((s) => `<button type="button" class="sp" data-v="${s}">${s}</button>`).join('')}</div>
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
  var DATA=${JSON.stringify(Object.fromEntries(Object.values(regions).map((r) => [r.name, Object.fromEntries(Object.values(r.districts).map((d) => [d.name, d.branches.map((b) => ({ n: b.name, d: b.dong, s: b.subjects }))]))])))};
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
  // 지점 선택 시 해당 지점 미개설 과목은 선택 불가 처리
  function updatePills(){
    var subs=null;
    if(sel.value&&sido.value&&gu.value){
      (DATA[sido.value][gu.value]||[]).forEach(function(b){if(b.n===sel.value)subs=b.s||null;});
    }
    document.querySelectorAll('.subj-pills .sp').forEach(function(b){
      var ok=!subs||subs.indexOf(b.getAttribute('data-v'))>-1;
      b.disabled=!ok;
      b.style.opacity=ok?'':'0.35';
      b.style.textDecoration=ok?'':'line-through';
      if(!ok)b.classList.remove('on');
    });
  }
  sel.addEventListener('change',updatePills);
  gu.addEventListener('change',updatePills);
  sido.addEventListener('change',updatePills);
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
    var s=document.createElement('script');s.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';s.onload=openPost;s.onerror=function(){alert('주소 검색을 불러오지 못했습니다. 이번만 주소를 직접 입력해 주세요.');var a=document.getElementById('fAddr');if(a){a.removeAttribute('readonly');a.focus();}};document.head.appendChild(s);
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
    if(!subj){alert('희망 과목을 1개 이상 선택해 주세요.');return;}
    if(!f.거주주소.value.trim()){document.getElementById('addrBtn').click();return;}
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
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`, 'utf8');
// IndexNow 키 검증 파일 (제출 크론은 sangsang-workers 중앙 크론이 매일 실행)
fs.writeFileSync(path.join(ROOT, '5e5ad86af25533efae3948773b676a6c.txt'), '5e5ad86af25533efae3948773b676a6c', 'utf8');
// RSS (공부법 칼럼 33편 — 네이버 서치어드바이저 RSS 제출용)
{
  const rfc822 = (d) => new Date(d + 'T09:00:00+09:00').toUTCString();
  const items = GUIDES.map((g, i) => {
    const pub = new Date(Date.UTC(2026, 6, 8) + (i % 8) * 86400000).toISOString().slice(0, 10);
    return `<item><title>${esc(g.title)}</title><link>${DOMAIN}/guide/${g.slug}/</link><guid isPermaLink="true">${DOMAIN}/guide/${g.slug}/</guid><description>${esc(g.desc)}</description><category>${esc(g.cat)}</category><pubDate>${rfc822(pub)}</pubDate></item>`;
  }).join('\n');
  fs.writeFileSync(path.join(ROOT, 'rss.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>${BRAND} 공부법 칼럼</title>\n<link>${DOMAIN}/guide/</link>\n<description>공부 습관, 내신 대비, 과목별 공부법, 학년별 가이드까지 ${BRAND}이 정리한 공부법 칼럼</description>\n<language>ko</language>\n<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n</channel></rss>`, 'utf8');
}
fs.writeFileSync(path.join(ROOT, 'CNAME'), 'wstudycenter.com\n', 'utf8');
fs.writeFileSync(path.join(ROOT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#22314e"/><text x="32" y="44" font-size="34" font-weight="800" text-anchor="middle" fill="#f0b58f" font-family="sans-serif">W</text></svg>`, 'utf8');
console.log('생성 완료:', urls.length, '페이지');
