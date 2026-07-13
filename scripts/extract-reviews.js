// center(wcoachingcenter.com)/reviews 페이지에서 후기 데이터 추출 → data/reviews.json
const fs = require('fs');
const t = fs.readFileSync('C:/Users/goodj/Desktop/AI/center(wcoachingcenter.com)/reviews/index.html', 'utf8');
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
fs.writeFileSync('C:/Users/goodj/Desktop/AI/wstudycenter.com/data/reviews.json', JSON.stringify(out, null, 1), 'utf8');
console.log('추출:', out.length, '건 / 카드', arts.length);
out.forEach((r) => console.log('-', r.gradeLabel, r.subject, '|', r.author, '|', r.meta));
