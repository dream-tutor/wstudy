// 2차 패스 — myschool 데이터에 없는 학교를 나이스 학교명 검색으로 보완
// 축약명을 전체형으로 확장해 SCHUL_NM 검색, 주소의 시도·시군구로 검증
const fs = require('fs');
const path = require('path');
const BRANCHES = require('../data/branches.json');

const OUT = path.join(__dirname, '..', 'data', 'school-info.json');
const cache = JSON.parse(fs.readFileSync(OUT, 'utf8'));

const SIDO_FULL = {
  서울: ['서울특별시'], 부산: ['부산광역시'], 대구: ['대구광역시'], 인천: ['인천광역시'],
  광주: ['광주광역시', '전남광주통합특별시(광주)'], 대전: ['대전광역시'], 울산: ['울산광역시'], 세종: ['세종특별자치시'],
  경기: ['경기도'], 강원: ['강원특별자치도', '강원도'], 충북: ['충청북도'], 충남: ['충청남도'],
  전북: ['전북특별자치도', '전라북도'], 전남: ['전라남도'], 경북: ['경상북도'], 경남: ['경상남도'], 제주: ['제주특별자치도'],
};
function fullNames(n) {
  if (/여고$/.test(n)) return [n.replace(/여고$/, '여자고등학교')];
  if (/여중$/.test(n)) return [n.replace(/여중$/, '여자중학교')];
  if (/고$/.test(n)) return [n + '등학교']; // ○○고 → ○○고등학교
  if (/중$/.test(n)) return [n + '학교'];
  if (/초$/.test(n)) return [n + '등학교'];
  return [n];
}
function normSchools(arr) {
  const out = [];
  for (const s of arr || []) for (const p of String(s).split(/[./\\]/)) { const t = p.trim(); if (t.length >= 2 && !out.includes(t)) out.push(t); }
  return out;
}

async function main() {
  const wanted = new Map();
  for (const b of Object.values(BRANCHES)) {
    for (const f of ['schools_elem', 'schools_mid', 'schools_high']) {
      for (const name of normSchools(b[f])) {
        const key = `${b.region}|${b.district}|${name}`;
        if (!cache[key]) wanted.set(key, { region: b.region, district: b.district, name, key });
      }
    }
  }
  console.log('2차 대상:', wanted.size);
  let done = 0, fail = 0, ambiguous = 0;
  for (const w of wanted.values()) {
    let hit = null;
    for (const fn of fullNames(w.name)) {
      try {
        const r = await fetch(`https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=${encodeURIComponent(fn)}`);
        const d = await r.json();
        const rows = (d.schoolInfo && d.schoolInfo[1] && d.schoolInfo[1].row) || [];
        // 주소 시도+시군구로 검증 (구 단위 district는 시 이름이 주소 앞에 붙으므로 포함 검사)
        const sidos = SIDO_FULL[w.region] || [];
        const ok = rows.filter((row) => {
          const addr = row.ORG_RDNMA || '';
          const sidoOk = sidos.some((s) => addr.startsWith(s)) || sidos.some((s) => (row.LCTN_SC_NM || '').startsWith(s.slice(0, 2)));
          return sidoOk && addr.includes(w.district.replace(/\s.*/, ''));
        });
        if (ok.length === 1) { hit = ok[0]; break; }
        if (ok.length > 1) { ambiguous++; break; }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 80));
    }
    if (hit) {
      cache[w.key] = {
        full: hit.SCHUL_NM, kind: hit.SCHUL_KND_SC_NM, found: hit.FOND_SC_NM,
        coedu: hit.COEDU_SC_NM, addr: (hit.ORG_RDNMA || '').trim(), tel: hit.ORG_TELNO,
        home: (hit.HMPG_ADRES || '').trim(), hstype: hit.HS_SC_NM || '',
      };
      done++;
    } else fail++;
    if ((done + fail) % 100 === 0) { console.log('진행:', done + fail, '/', wanted.size); fs.writeFileSync(OUT, JSON.stringify(cache), 'utf8'); }
    await new Promise((r) => setTimeout(r, 80));
  }
  fs.writeFileSync(OUT, JSON.stringify(cache), 'utf8');
  console.log('완료 — 성공:', done, '모호:', ambiguous, '실패:', fail, '총 캐시:', Object.keys(cache).length);
}
main();
