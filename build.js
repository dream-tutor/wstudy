// 와와학습학원 (wstudycenter.com) 정적 페이지 생성기
// 실행: node build.js  → 폴더 루트에 페이지 생성 (center 저장소와 같은 배포 패턴)
const fs = require('fs');
const path = require('path');
const BRANCHES = require('./data/branches.json');
const VIDEOS = require('./data/videos.json');
const COPY = require('./lib/copy.js');
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
  return `<h2 id="fee">수강료 안내</h2><p style="color:var(--ink-soft);font-size:14px;margin-bottom:4px">교육청 등록 기준 공시 금액(월, 원)입니다. 자세한 시간, 횟수는 상담 시 조율합니다.</p>
<div class="tbl-scroll"><table class="info-table fee-table"><thead><tr><th>학년</th>${hasMin ? '<th>1회 수업</th>' : ''}<th>주2회</th><th>주3회</th><th>주5회</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
function shell({ title, desc, canonical, body, depth, ld, ogTitle, footExtra }) {
  const base = depth ? '../'.repeat(depth) : './';
  // 페이지 LD + 브레드크럼 LD 병합 (@graph)
  const graph = [];
  if (ld) { if (ld['@graph']) graph.push(...ld['@graph']); else { const o = { ...ld }; delete o['@context']; graph.push(o); } }
  if (CRUMB_LD) { graph.push(CRUMB_LD); CRUMB_LD = null; }
  const ldJson = graph.length ? JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) : '';
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
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/style.css">
${ldJson ? `<script type="application/ld+json">${ldJson}</script>` : ''}
</head>
<body>
<div class="topbar"><span>초·중·고 교과 전문 ${BRAND}</span><a href="tel:${TEL}">전화 상담</a></div>
<header class="site"><div class="in">
<a class="logo" href="${base}">와와학습학원<span class="dot">.</span></a>
<nav class="gnb"><a class="cta" href="${base}inquiry/">상담 신청</a></nav>
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
</script>
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
  return html + '</div>';
}
function video(v, cap) {
  if (!v) return '';
  return `<div class="video-box"><div class="frame${v.shorts ? ' vertical' : ''}"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${v.id}" title="${esc(v.title)}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><div class="cap">▶ ${esc(cap || v.title)} (와와 공식 유튜브)</div></div>`;
}
function ctaBand(b, depth) {
  const base = '../'.repeat(depth);
  const q = b ? '?지점=' + encodeURIComponent(b.name) : '';
  const kko = b && (b.kakao_link || b.link);
  return `<div class="cta-band"><div class="t">상담 안내</div><div class="d">학생의 학교, 학년, 현재 성적을 알려 주시면 필요한 수업을 구체적으로 안내해 드립니다.</div><div class="btns"><a class="tel" href="tel:${TEL}">전화 상담</a><a class="form" href="${base}inquiry/${q}">상담 신청서 작성</a>${kko ? `<a class="map" href="${kko}" target="_blank" rel="noopener">카카오맵으로 길찾기</a>` : ''}</div></div>`;
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
// 지점 위치 지도 (OSM 임베드 — 키 불필요)
function osmMap(b) {
  if (!b.lat || !b.lng) return '';
  const d = 0.005, dx = 0.008;
  const bbox = encodeURIComponent(`${b.lng - dx},${b.lat - d},${b.lng + dx},${b.lat + d}`);
  return `<h2>오시는 길</h2><div class="mapbox"><iframe loading="lazy" title="${esc(b.name)} 위치 지도" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${b.lat}%2C${b.lng}"></iframe><div class="cap">${esc(b.address)}${b.nearby_text ? ' · ' + esc((b.nearby_text.split('/')[1] || '').trim()) : ''}</div></div>`;
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
function classPhoto(depth) {
  return `<div class="photo"><img loading="lazy" src="${'../'.repeat(depth)}assets/wawa-class.jpg" alt="와와 교실 내부" width="900" height="664"><div class="cap">와와 교실 환경 (지점별 시설과 배치는 다를 수 있습니다)</div></div>`;
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
    { q: '학원을 다니는데 성적이 그대로예요', a: '원인은 대부분 학생 수준과 맞지 않는 일괄 진도입니다. 와와는 진단으로 시작점을 찾고, 학생마다 교재와 단원을 다르게 잡습니다.' },
    { q: '혼자서는 책상에 앉지를 않아요', a: '의지의 문제가 아니라 틀의 문제입니다. 매 수업 숙제 검사와 테스트로 공부가 돌아가는 틀을 학원이 만들어 줍니다.' },
    { q: '우리 학교 시험 스타일을 아는 곳이 없어요', a: '지점마다 인근 학교 재학생이 다녀서 학교별 진도, 필기, 기출 정보가 매 학기 쌓입니다. 시험 3~4주 전부터 그 자료로 대비합니다.' },
    { q: '수행평가까지 챙겨 주는 곳이 필요해요', a: '학기 초 평가 계획을 확인해 두고, 제출물은 마감 전까지 학원 일정에서 관리합니다. 지필과 수행을 합쳐야 등급이 나오기 때문입니다.' },
  ];
  const STEPS = [
    ['진단 상담', '학교, 학년, 현재 성적을 보고 어느 단원부터 시작할지 정합니다.'],
    ['개별 진도 수업', '같은 교실에서도 학생마다 교재와 단원이 다릅니다.'],
    ['숙제·테스트 사이클', '배운 것을 집에서 풀고, 다음 수업에서 확인합니다. 매주 반복됩니다.'],
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
    { q: '다른 학원과 무엇이 다른가요?', a: '일괄 진도 수업 대신 진단 후 학생마다 교재와 단원을 다르게 잡는 개별 진도로 수업하고, 시험 기간에는 학생이 다니는 학교의 기출과 수업 자료 기준으로 내신을 준비합니다.' },
    { q: '몇 학년부터 다닐 수 있나요?', a: '지점에 따라 초등 저학년부터 고3까지 받습니다. 각 지점 페이지의 과목별 대상 학년 표에서 확인할 수 있습니다.' },
  ];
  const faqLd = { '@type': 'FAQPage', mainEntity: HOME_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const body = `
<div class="hero"><div class="in">
<div class="award">2025 소비자가 뽑은 올해의 대상 · 교육 부문 수상</div>
<h1>학교 시험은<br><em>학교를 아는 학원</em>에서</h1>
<p>${BRAND}은 전국 ${total}개 지점이 있는 초·중·고 교과 학원입니다. 학생이 다니는 학교의 진도에 맞춰 수업하고, 시험 기간에는 학교별 자료로 내신을 준비합니다. 국어·영어·수학·사회·과학, ${totalSchools}개 학교를 관리하고 있습니다.</p>
<div class="btns"><a class="b1" href="./inquiry/">상담 신청</a><a class="b2" href="#regions">가까운 지점 찾기</a></div>
<div class="stats"><div class="s"><div class="n">${total}</div><div class="k">전국 지점</div></div><div class="s"><div class="n">${totalSchools}</div><div class="k">관리 학교</div></div><div class="s"><div class="n">5과목</div><div class="k">국·영·수·사·과</div></div></div>
</div></div>
<div class="wrap"><section class="home">

<h2>이런 고민으로 오시는 분들이 많습니다</h2>
<div class="sec-sub">상담에서 실제로 가장 자주 듣는 이야기들입니다.</div>
<div class="worry-grid">${WORRIES.map((w) => `<div class="worry"><div class="q">${esc(w.q)}</div><div class="a">${esc(w.a)}</div></div>`).join('')}</div>

<h2>수업은 이렇게 진행됩니다</h2>
<div class="sec-sub">${total}개 지점이 같은 방식으로 운영됩니다.</div>
<div class="steps">${STEPS.map((s, i) => `<div class="step"><span class="no">${i + 1}</span><div class="t">${esc(s[0])}</div><div class="d">${esc(s[1])}</div></div>`).join('')}</div>
<article class="body">
<p>학원의 성과는 학생이 다니는 학교의 시험에서 확인됩니다. 그래서 와와학습학원의 커리큘럼은 학원 편의가 아니라 학교 기준입니다. 지점마다 인근 학교 재학생들이 다니기 때문에 학교별 진도와 시험 정보가 매 학기 쌓이고, 시험 기간이 되면 그 자료가 수업의 중심이 됩니다. 화려한 설명회 대신, 진단과 개별 진도와 매주 반복되는 확인으로 성적을 만드는 곳입니다.</p>
</article>
${classPhoto(0)}

<h2>과목별 수업</h2>
<div class="sec-sub">다섯 과목 모두 학교 진도 동기화가 원칙입니다. 과목명 옆 글에서 수업 방식을 자세히 볼 수 있습니다.</div>
<div class="list-grid">${SUBJ_HOME.map(([n, d, g]) => `<a href="./guide/${g}/">${n}학원 수업<span class="cnt">${esc(d)}</span></a>`).join('')}</div>

<h2>학년별 안내</h2>
<div class="lv-grid">
<div class="lv"><div class="t">초등부</div><p>진도 경쟁보다 습관과 기본기입니다. 매 수업 정해진 분량을 스스로 끝내는 연습과 연산·어휘 점검으로 중학교를 준비합니다.</p><a href="./guide/elem-habit/">초등 고학년, 성적보다 습관 →</a></div>
<div class="lv"><div class="t">중등부</div><p>지필고사와 수행평가가 성적을 만드는 시기입니다. 시험 4주 전 대비 일정과 수행 제출 관리까지 학원이 챙깁니다.</p><a href="./guide/exam-4weeks/">내신 4주 대비 플랜 →</a></div>
<div class="lv"><div class="t">고등부</div><p>내신, 수행, 생기부를 한 흐름으로 관리합니다. 수업에서 다룬 내용을 교과 세특 주제로 이어 줍니다.</p><a href="./guide/saenggibu-setek/">교과 세특 만들기 →</a></div>
</div>

<h2>다녀 본 학생과 학부모의 이야기</h2>
<div class="rev-grid three">${REVIEWS.slice(0, 3).map((r) => `<div class="rev"><div class="stars">★★★★★</div><div class="rtags"><span>${esc(r.gradeLabel)}</span><span>${esc(r.subject)}</span></div><p>${esc(r.text.length > 100 ? r.text.slice(0, 100) + '…' : r.text)}</p><div class="who">${esc(r.author)} · ${esc(r.meta)}</div></div>`).join('')}</div>
<div class="more-link"><a href="./review/">수강후기 전체 보기 →</a></div>

<h2 id="regions">지역별 지점 찾기</h2>
<div class="sec-sub">지점명, 동네, 학교 이름으로 검색하거나 지도에서 지역을 선택하세요.</div>
<div class="sbox"><input id="q" type="search" placeholder="지점·동네·학교 검색 (예: 산본점, 덕풍동, 산본중)" autocomplete="off" aria-label="지점 검색"><div id="sres" class="sres"></div></div>
<div class="kmap">${kmapHtml}</div>

<h2>영상으로 보는 와와</h2>
<div class="sec-sub">공식 유튜브 채널의 소개·인터뷰 영상입니다.</div>
${video(VIDEOS.pools.brand[0])}
${video(VIDEOS.pools.interview[0], '합격 인터뷰: 평택 와와에서 서울대 합격생이 나온 이유')}
<p style="font-size:14px;color:var(--ink-soft)">더 많은 영상은 <a href="https://www.youtube.com/@wawacoachingcenter" target="_blank" rel="noopener" style="color:var(--brick);font-weight:600">유튜브 채널</a>에서 볼 수 있습니다.</p>

<h2>자주 묻는 질문</h2>
<div class="faq">${HOME_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
${ctaBand(null, 0)}
</section></div>
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
  const gradeRows = Object.entries(b.grades_by_subject || {}).filter(([, g]) => g).map(([s, g]) => `<tr><th>${esc(s)}</th><td>${esc(gradeRange(g))}</td></tr>`).join('');
  const faq = faqHtml([COPY.faqPool.common[0], COPY.faqPool.common[1], COPY.faqPool.common[2]], { tel: TEL, branchName: b.name });
  const levels = levelsOf(b);
  const gradeBlocks = levels.map((lv) => pick(COPY.gradeBlock[lv], key + lv)()).join('');
  const body = `<div class="wrap">
${crumb(3, [{ name: r.name, slug: r.slug }, { name: d.name, slug: d.slug }, { name: b.name }])}
<div class="page-head"><span class="tag">${esc(d.name)} ${esc(b.dong)}</span>${specBadge(b.name)}<h1>${BRAND} ${esc(b.name)}</h1><div class="sub">${esc(lede)}</div></div>
<article class="body">
${bv ? '<h2>영상으로 보는 ' + esc(b.name) + '</h2>' + video(bv) : '<h2>영상으로 보는 와와</h2>' + video(pick(VIDEOS.pools.brand, b.branch_slug + 'promo'), '와와 소개 영상')}
<h2>지점 안내</h2>
<div class="tbl-scroll"><table class="info-table">
<tr><th>주소</th><td>${esc(b.address)}${b.location_guide ? `<br><span style="color:var(--ink-soft);font-size:13.5px">${esc(b.location_guide).replace(/\n/g, '<br>')}</span>` : ''}</td></tr>
${nearbyRow(b)}
<tr><th>수업 과목</th><td>${esc((b.subjects || []).join(', '))}</td></tr>
${gradeRows}
<tr><th>수업 시간</th><td>${esc(b.open_time || '상담 시 안내')}${b.weekend ? ` · ${esc(b.weekend)}` : ''}</td></tr>
<tr><th>운영 안내</th><td>상담은 예약제로 진행됩니다 · 셔틀버스는 운영하지 않습니다 · 수업비는 아래 <a href="#fee" style="color:var(--brick);font-weight:600">수강료 안내</a> 참고</td></tr>
</table></div>
${osmMap(b)}
${pick(COPY.wawaWay, b.branch_slug + 'way')()}
${classPhoto(3)}
${gradeBlocks}
<h2>과목별 수업 안내</h2>
<p>과목을 선택하면 ${esc(b.dong)} 기준의 수업 방식과 내신 대비 흐름을 자세히 볼 수 있습니다.</p>
<div class="chips">${subjectLinks}</div>
<h2>관리 학교</h2>
<p>${esc(b.name)}에 다니는 학생들의 소속 학교입니다. 학교별 시험 대비 안내는 학교 이름을 눌러 확인하세요. <strong>목록에 없는 인근 학교 학생도 수업이 가능하니</strong> 상담에서 확인해 주세요.</p>
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
${grades ? `<div class="note">${esc(b.name)} ${esc(subj)} 수업 대상: ${esc(gradeRange(grades))}</div>` : ''}
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
${pick(COPY.wawaWay, key + 'way')()}
<h2>${esc(s.name)} 학생이 다닐 수 있는 지점</h2>
<div class="tbl-scroll"><table class="info-table">${bRows}</table></div>
${(() => {
  const mpts = s.branches.filter((b) => b.lat && b.lng).map((b) => ({ n: b.name, la: b.lat, lo: b.lng, u: `../../${b.branch_slug}/` }));
  const scOk = geo && s.branches.some((b) => b.lat && b.lng && distM(geo.lat, geo.lng, b.lat, b.lng) <= 8000);
  return branchesMap(mpts, [], scOk ? { n: s.name, la: geo.lat, lo: geo.lng } : null);
})()}
${(b0.subjects || []).length ? `<h2>${esc(s.name)} 재학생 수업 과목</h2><p>${esc(b0.name)}에서 ${esc(s.name)} 학생이 들을 수 있는 과목은 ${esc((b0.subjects || []).join(', '))}입니다. ${s.level === '초' ? '초등부는 교과 진도를 따라가면서 공부 습관과 기본기를 함께 관리합니다.' : s.level === '중' ? '평소에는 학교 진도 기준으로 수업하고, 시험 기간에는 ' + esc(s.name) + ' 범위에 맞춘 내신 대비로 전환됩니다. 수행평가 일정도 수업 계획에 반영합니다.' : '수업은 학교 진도와 동기화되며, 내신 4주 전부터 ' + esc(s.name) + ' 기출 유형 중심의 실전 대비로 바뀝니다. 과목별 수업 방식은 아래에서 확인할 수 있습니다.'}</p><div class="chips">${(b0.subjects || []).filter((su) => SUBJ_SLUG[su]).map((su) => `<a href="../../${b0.branch_slug}/${SUBJ_SLUG[su]}/">${esc(b0.dong)} ${esc(su)}학원</a>`).join('')}</div>` : ''}
${bv ? '<h2>영상으로 보는 ' + esc(b0.name) + '</h2>' + video(bv) : '<h2>영상으로 보는 와와</h2>' + video(pick(VIDEOS.pools.brand, key + 'promo'), '와와 소개 영상')}
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
    desc: `공부 습관, 내신 대비, 과목별 공부법, 학년별 가이드, 입시와 생기부까지 ${BRAND}이 정리한 공부법 칼럼 ${GUIDES.length}편.`,
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
<label>연락처</label><input name="연락처" required placeholder="010-0000-0000" inputmode="tel">
<label>주소 <span style="font-weight:400;color:var(--ink-soft)">(도로명까지만 적어 주세요)</span></label><input name="거주주소" placeholder="예: 경기 군포시 산본로 394">
<label>학교 / 학년</label><input name="학년" placeholder="예: 덕풍중 2학년">
<label>희망 과목 <span style="font-weight:400;color:var(--ink-soft)">(누르면 선택됩니다)</span></label>
<div class="subj-pills">${['국어', '영어', '수학', '사회', '과학'].map((s) => `<button type="button" class="sp" data-v="${s}">${s}</button>`).join('')}</div>
<button type="submit" class="submit-btn">상담 신청하기</button>
</form>
<div class="form-ok" id="ok"><div class="big">신청이 접수되었습니다</div><p>지점에서 상담 시간을 잡아 연락드리겠습니다.</p></div>
</div></div>
<script>
(function(){
  if(new URLSearchParams(location.search).get('embed')==='1'){document.documentElement.classList.add('embed');}
  var DATA=${JSON.stringify(Object.fromEntries(Object.values(regions).map((r) => [r.name, Object.fromEntries(Object.values(r.districts).map((d) => [d.name, d.branches.map((b) => ({ n: b.name, d: b.dong }))]))])))};
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
  document.querySelectorAll('.subj-pills .sp').forEach(function(b){b.addEventListener('click',function(){b.classList.toggle('on')})});
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var f=e.target,btn=f.querySelector('.submit-btn');
    var subj=Array.from(document.querySelectorAll('.subj-pills .sp.on')).map(function(x){return x.getAttribute('data-v')}).join(', ');
    if(!subj){alert('희망 과목을 1개 이상 선택해 주세요.');return;}
    btn.disabled=true;btn.textContent='전송 중...';
    var data={지점:f.지점.value||'일반문의(와와학습학원)',이름:f.이름.value,연락처:f.연락처.value,거주주소:f.거주주소.value,학년:f.학년.value,과목:subj,신청일:new Date().toLocaleString('ko-KR'),유입페이지:location.href,유입페이지제목:document.title,유입경로:document.referrer||'직접입력'};
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
const LASTMOD = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `<url><loc>${DOMAIN}/${encodeURI(u)}</loc><lastmod>${LASTMOD}</lastmod></url>`).join('\n') + '\n</urlset>', 'utf8');
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`, 'utf8');
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
