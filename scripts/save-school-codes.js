// wstudy 학교 → 나이스 학교코드(교육청|학교) 매핑 → data/school-codes.json
// 1차: myschool schools.js(코드 보유)와 매칭 — 즉시. 2차: 나이스 이름 검색으로 보완.
const fs = require('fs');
const path = require('path');
const BRANCHES = require('../data/branches.json');
const OUT = path.join(__dirname, '..', 'data', 'school-codes.json');
const codes = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

function normSchools(arr) {
  const out = [];
  for (const s of arr || []) for (const p of String(s).split(/[./\\]/)) { const t = p.trim(); if (t.length >= 2 && !out.includes(t)) out.push(t); }
  return out;
}
function fullNames(n) {
  if (/여고$/.test(n)) return [n.replace(/여고$/, '여자고등학교')];
  if (/여중$/.test(n)) return [n.replace(/여중$/, '여자중학교')];
  if (/고$/.test(n)) return [n + '등학교'];
  if (/중$/.test(n)) return [n + '학교'];
  if (/초$/.test(n)) return [n + '등학교'];
  return [n];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const m = await import('file:///C:/Users/goodj/Desktop/AI/%EC%9A%B0%EB%A6%AC%ED%95%99%EA%B5%90%EA%B3%BC%EC%99%B8.com/myschool-workers/src/data/schools.js');
  const SCHOOLS = m.SCHOOLS;
  const wanted = new Map();
  for (const b of Object.values(BRANCHES)) {
    for (const f of ['schools_elem', 'schools_mid', 'schools_high']) {
      for (const name of normSchools(b[f])) {
        const key = `${b.region}|${b.district}|${name}`;
        if (!(key in codes)) wanted.set(key, { region: b.region, district: b.district, name, key });
      }
    }
  }
  console.log('대상:', wanted.size, '(캐시', Object.keys(codes).length + ')');

  // 1차 — myschool 데이터 매칭
  let hit1 = 0;
  const rest = [];
  for (const w of wanted.values()) {
    const sido = SCHOOLS[w.region];
    let hits = [];
    if (sido) {
      const buckets = Object.keys(sido);
      const pri = buckets.filter((g) => g === w.district || g.startsWith(w.district) || w.district.startsWith(g.split(' ')[0]));
      for (const g of pri) for (const s of sido[g]) if (s.n === w.name) hits.push(s);
      if (!hits.length) for (const g of buckets) for (const s of sido[g]) if (s.n === w.name) hits.push(s);
    }
    const uniq = [...new Map(hits.map((h) => [h.c, h])).values()];
    if (uniq.length === 1) { codes[w.key] = uniq[0].c; hit1++; }
    else rest.push(w);
  }
  console.log('1차 매칭:', hit1, '| 2차 대상:', rest.length);
  fs.writeFileSync(OUT, JSON.stringify(codes), 'utf8');

  // 2차 — 나이스 이름 검색 (키 없이 단건)
  let hit2 = 0, fail = 0, n = 0;
  const SIDO_PREFIX = { 서울: '서울', 부산: '부산', 대구: '대구', 인천: '인천', 광주: '광주', 대전: '대전', 울산: '울산', 세종: '세종', 경기: '경기', 강원: '강원', 충북: '충청북', 충남: '충청남', 전북: '전', 경북: '경상북', 경남: '경상남', 제주: '제주' };
  for (const w of rest) {
    let code = null;
    for (const fn of fullNames(w.name)) {
      try {
        const r = await fetch('https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=' + encodeURIComponent(fn), { headers: { 'User-Agent': 'wstudycenter-build/1.0' } });
        const d = await r.json();
        const rows = (d.schoolInfo && d.schoolInfo[1] && d.schoolInfo[1].row) || [];
        const ok = rows.filter((row) => {
          const addr = row.ORG_RDNMA || '';
          const pre = SIDO_PREFIX[w.region] || w.region;
          return addr.includes(w.district.replace(/\s.*/, '')) && ((row.LCTN_SC_NM || '').startsWith(pre) || addr.startsWith(pre));
        });
        if (ok.length === 1) { code = `${ok[0].ATPT_OFCDC_SC_CODE}|${ok[0].SD_SCHUL_CODE}`; break; }
      } catch (e) {}
      await sleep(900);
    }
    if (code) { codes[w.key] = code; hit2++; } else { codes[w.key] = null; fail++; }
    if (++n % 50 === 0) { fs.writeFileSync(OUT, JSON.stringify(codes), 'utf8'); console.log('2차 진행:', n, '/', rest.length); }
    await sleep(300);
  }
  fs.writeFileSync(OUT, JSON.stringify(codes), 'utf8');
  console.log('완료 — 1차:', hit1, '2차:', hit2, '실패:', fail, '총:', Object.keys(codes).length);
}
main();
