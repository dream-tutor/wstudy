// 학교 좌표 수집 — OSM Nominatim (정책: 1req/sec, UA 필수) → data/school-geo.json
// 1차: 학교 정식명+시군구, 2차: 나이스 도로명주소
const fs = require('fs');
const path = require('path');
const INFO = require('../data/school-info.json');
const OUT = path.join(__dirname, '..', 'data', 'school-geo.json');
const geo = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function query(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'User-Agent': 'wstudycenter-site-build/1.0 (amystic57@gmail.com)' } });
  if (!r.ok) return null;
  const d = await r.json();
  return d[0] ? { lat: +d[0].lat, lng: +d[0].lon } : null;
}

(async () => {
  const keys = Object.keys(INFO).filter((k) => !geo[k]);
  console.log('대상:', keys.length, '(캐시', Object.keys(geo).length + ')');
  let ok = 0, fail = 0, n = 0;
  for (const key of keys) {
    const info = INFO[key];
    const [, district] = key.split('|');
    let hit = null;
    try {
      hit = await query(`${info.full}, ${district}`);
      await sleep(1100);
      if (!hit && info.addr) { hit = await query(info.addr); await sleep(1100); }
    } catch (e) { await sleep(2000); }
    if (hit) { geo[key] = hit; ok++; } else { geo[key] = null; fail++; } // null도 기록해 재시도 방지
    if (++n % 50 === 0) { fs.writeFileSync(OUT, JSON.stringify(geo), 'utf8'); console.log('진행:', n, '/', keys.length, '성공:', ok); }
  }
  fs.writeFileSync(OUT, JSON.stringify(geo), 'utf8');
  console.log('완료 — 성공:', ok, '실패:', fail);
})();
