// center(wcoachingcenter.com)/reviews 페이지에서 후기 데이터 추출 → data/reviews.json
// ⚠ 다시 돌리지 말 것: data/reviews.json은 추출 뒤 손으로 고쳤다(지점명 실존 지점으로 교정 e1f947ffc,
//   2026-09-17 점검으로 입시·합격 후기 2건과 중3 '1등급' 후기 제외, 오타·타 학원 비하 문장 정리). 다시 추출하면 전부 되돌아간다.
const fs = require('fs');
const path = require('path');
const t = fs.readFileSync(path.join(__dirname, '..', '..', 'center(wcoachingcenter.com)', 'reviews', 'index.html'), 'utf8');
const arts = [...t.matchAll(/<article class="review-card" data-grade="(\w+)">([\s\S]*?)<\/article>/g)];
const out = [];
for (const [, grade, inner] of arts) {
  const tags = [...inner.matchAll(/review-tag[^"]*">([^<]*)<\/span>/g)].map((x) => x[1].trim());
  const text = (inner.match(/<p class="review-text">([\s\S]*?)<\/p>/) || [])[1];
  const author = (inner.match(/review-meta-name">([^<]*)</) || [])[1];
  const meta = (inner.match(/review-meta-info">([^<]*)</) || [])[1];
  if (!text) continue;
  out.push({
    grade,
    gradeLabel: tags[0] || '',
    subject: tags.slice(1).join(' · '),
    text: text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    author: (author || '').trim(),
    meta: (meta || '').trim(),
  });
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'reviews.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('추출:', out.length, '건 / 카드', arts.length);
out.forEach((r) => console.log('-', r.gradeLabel, r.subject, '|', r.author, '|', r.meta));
