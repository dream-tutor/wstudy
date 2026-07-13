// wstudy 학교 페이지 보강용 — 나이스 학교기본정보 수집
// 1) branches.json의 학교명을 myschool의 schools.js(학교코드 포함)와 매칭
// 2) 나이스 schoolInfo를 학교코드 단건 조회(키 불필요)로 받아 data/school-info.json 캐시
// 사용: node scripts/fetch-school-info.js
const fs = require('fs');
const path = require('path');
const BRANCHES = require('../data/branches.json');

const OUT = path.join(__dirname, '..', 'data', 'school-info.json');
const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

function normSchools(arr) {
  const out = [];
  for (const s of arr || []) for (const p of String(s).split(/[./\\]/)) { const t = p.trim(); if (t.length >= 2 && !out.includes(t)) out.push(t); }
  return out;
}

async function main() {
  const m = await import('file:///C:/Users/goodj/Desktop/AI/%EC%9A%B0%EB%A6%AC%ED%95%99%EA%B5%90%EA%B3%BC%EC%99%B8.com/myschool-workers/src/data/schools.js');
  const SCHOOLS = m.SCHOOLS;

  // 우리 학교 목록: region/district/학교명
  const wanted = new Map(); // key region|district|name
  for (const b of Object.values(BRANCHES)) {
    for (const f of ['schools_elem', 'schools_mid', 'schools_high']) {
      for (const name of normSchools(b[f])) wanted.set(`${b.region}|${b.district}|${name}`, { region: b.region, district: b.district, name });
    }
  }
  console.log('대상 학교(지역 포함 고유):', wanted.size);

  // 매칭: 같은 시도에서 시군구가 우리 district로 시작/포함하는 버킷 우선, 없으면 시도 전체에서 유일할 때만
  let matched = 0, ambiguous = 0, missing = 0;
  const jobs = [];
  for (const w of wanted.values()) {
    const sido = SCHOOLS[w.region];
    if (!sido) { missing++; continue; }
    const buckets = Object.keys(sido);
    const pri = buckets.filter((g) => g === w.district || g.startsWith(w.district) || w.district.startsWith(g.split(' ')[0]));
    let hits = [];
    for (const g of pri) for (const s of sido[g]) if (s.n === w.name) hits.push(s);
    if (!hits.length) {
      for (const g of buckets) for (const s of sido[g]) if (s.n === w.name) hits.push(s);
    }
    const uniq = [...new Map(hits.map((h) => [h.c, h])).values()];
    if (uniq.length === 1) { matched++; jobs.push({ key: `${w.region}|${w.district}|${w.name}`, code: uniq[0].c }); }
    else if (uniq.length > 1) ambiguous++;
    else missing++;
  }
  console.log('매칭:', matched, '| 모호(제외):', ambiguous, '| 미발견:', missing);

  // 나이스 조회 (캐시에 없는 것만)
  const todo = jobs.filter((j) => !cache[j.key]);
  console.log('조회 필요:', todo.length, '(캐시', Object.keys(cache).length + '건)');
  let done = 0, fail = 0;
  const CONC = 5;
  async function worker(list) {
    for (const j of list) {
      const [atpt, code] = j.code.split('|');
      try {
        const r = await fetch(`https://open.neis.go.kr/hub/schoolInfo?Type=json&ATPT_OFCDC_SC_CODE=${atpt}&SD_SCHUL_CODE=${code}`);
        const d = await r.json();
        const row = d.schoolInfo && d.schoolInfo[1] && d.schoolInfo[1].row && d.schoolInfo[1].row[0];
        if (row) {
          cache[j.key] = {
            full: row.SCHUL_NM, kind: row.SCHUL_KND_SC_NM, found: row.FOND_SC_NM,
            coedu: row.COEDU_SC_NM, addr: (row.ORG_RDNMA || '').trim(), tel: row.ORG_TELNO,
            home: (row.HMPG_ADRES || '').trim(), hstype: row.HS_SC_NM || '',
          };
          done++;
        } else fail++;
      } catch (e) { fail++; }
      if ((done + fail) % 100 === 0) { console.log('진행:', done + fail, '/', todo.length); fs.writeFileSync(OUT, JSON.stringify(cache), 'utf8'); }
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  const chunks = Array.from({ length: CONC }, (_, i) => todo.filter((_, idx) => idx % CONC === i));
  await Promise.all(chunks.map(worker));
  fs.writeFileSync(OUT, JSON.stringify(cache), 'utf8');
  console.log('완료 — 성공:', done, '실패:', fail, '총 캐시:', Object.keys(cache).length);
}
main();
