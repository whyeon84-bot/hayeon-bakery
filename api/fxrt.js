// 관세청 주간 관세환율 (공공데이터포털)
// 키(DATA_KEY)는 서버에만 두고, 브라우저에는 결과만 내려보낸다.

const ENDPOINT =
  'https://apis.data.go.kr/1220000/retrieveTrifFxrtInfo/getRetrieveTrifFxrtInfo';

// 제빵 재료 수입과 관련 있는 통화 위주로 추린다.
const MAJORS = [
  { code: 'EUR', ko: '유로',        flag: '🇪🇺', note: '프랑스 AOP 버터' },
  { code: 'USD', ko: '미국 달러',   flag: '🇺🇸', note: '설탕 · 견과류' },
  { code: 'JPY', ko: '일본 엔',     flag: '🇯🇵', note: '박력분 · 제과도구' },
  { code: 'AUD', ko: '호주 달러',   flag: '🇦🇺', note: '제빵용 밀' },
  { code: 'CAD', ko: '캐나다 달러', flag: '🇨🇦', note: '강력분 밀' },
  { code: 'CHF', ko: '스위스 프랑', flag: '🇨🇭', note: '초콜릿' },
  { code: 'GBP', ko: '영국 파운드', flag: '🇬🇧', note: '클로티드 크림' },
  { code: 'CNY', ko: '중국 위안',   flag: '🇨🇳', note: '포장 자재' },
];

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// 서버 시간대와 무관하게 한국 날짜를 쓴다.
function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function parseItems(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const pick = (tag) => {
      const g = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return g ? g[1].trim() : '';
    };
    out.push({
      applyDate: pick('aplyBgnDt'),
      currency: pick('currSgn'),
      rate: parseFloat(pick('fxrt').replace(/,/g, '')),
      nameEn: pick('mtryUtNm'),
    });
  }
  return out;
}

async function fetchOnce(key, dateStr) {
  // 키는 이미 URL 인코딩된 형태이므로 그대로 붙인다 (다시 인코딩하면 인증 실패).
  const url =
    `${ENDPOINT}?serviceKey=${key}` +
    `&aplyBgnDt=${dateStr}&weekFxrtTpcd=2&numOfRows=200`;

  const r = await fetch(url, { headers: { Accept: 'application/xml' } });
  if (!r.ok) throw new Error(`상위 API 응답 오류 (HTTP ${r.status})`);
  const xml = await r.text();

  if (xml.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')) {
    throw new Error('인증키가 등록되지 않았습니다.');
  }
  return parseItems(xml);
}

export default async function handler(req, res) {
  const key = process.env.DATA_KEY;
  if (!key) {
    res.status(500).json({ ok: false, error: 'DATA_KEY 환경변수가 없습니다.' });
    return;
  }

  try {
    // 관세환율은 주 단위로 고시된다. 오늘 기준으로 없으면 며칠씩 뒤로 물러나며 찾는다.
    let items = [];
    const base = kstNow();
    for (let back = 0; back <= 14 && items.length === 0; back += 7) {
      const d = new Date(base);
      d.setDate(d.getDate() - back);
      items = await fetchOnce(key, ymd(d));
    }

    if (items.length === 0) {
      res.status(502).json({ ok: false, error: '환율 데이터를 찾지 못했습니다.' });
      return;
    }

    const byCode = new Map(items.map((i) => [i.currency, i]));
    const rates = MAJORS
      .map((m) => {
        const hit = byCode.get(m.code);
        if (!hit || !isFinite(hit.rate)) return null;
        return { ...m, rate: hit.rate, nameEn: hit.nameEn };
      })
      .filter(Boolean);

    // 하루 한 번 정도만 새로 받아오면 충분하다 (CDN 캐시).
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      ok: true,
      applyDate: items[0].applyDate,
      basis: '수입 과세환율',
      source: '관세청 · 공공데이터포털',
      rates,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
}
