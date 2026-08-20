// 관세청 주간 관세환율 — 최근 6개월(약 26주) 이력
// 관세환율은 매주 일요일자로 고시되므로 일요일 날짜를 7일씩 거슬러 조회한다.

const ENDPOINT =
  'https://apis.data.go.kr/1220000/retrieveTrifFxrtInfo/getRetrieveTrifFxrtInfo';

const ALLOWED = new Set(['USD', 'EUR']);
const WEEKS = 26;      // 약 6개월
const BATCH = 7;       // 동시에 던지는 요청 수 (함수 실행시간 고려)

function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

// 오늘(KST) 기준 가장 가까운 지난 일요일
function lastSunday() {
  const d = kstNow();
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function pickRate(xml, code) {
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    if (!new RegExp(`<currSgn>${code}</currSgn>`).test(b)) continue;
    const applied = (b.match(/<aplyBgnDt>([\s\S]*?)<\/aplyBgnDt>/) || [])[1];
    const raw = (b.match(/<fxrt>([\s\S]*?)<\/fxrt>/) || [])[1];
    const rate = parseFloat(String(raw).replace(/,/g, ''));
    if (isFinite(rate)) return { date: applied, rate };
  }
  return null;
}

async function fetchWeek(key, dateStr, code) {
  try {
    const url =
      `${ENDPOINT}?serviceKey=${key}` +
      `&aplyBgnDt=${dateStr}&weekFxrtTpcd=2&numOfRows=200`;
    const r = await fetch(url, { headers: { Accept: 'application/xml' } });
    if (!r.ok) return null;
    const xml = await r.text();
    if (xml.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')) return null;
    return pickRate(xml, code);
  } catch {
    return null; // 한 주가 비어도 전체는 계속 그린다
  }
}

export default async function handler(req, res) {
  const key = process.env.DATA_KEY;
  if (!key) {
    res.status(500).json({ ok: false, error: 'DATA_KEY 환경변수가 없습니다.' });
    return;
  }

  const code = String(req.query.code || 'USD').toUpperCase();
  if (!ALLOWED.has(code)) {
    res.status(400).json({ ok: false, error: '지원하지 않는 통화입니다.' });
    return;
  }

  try {
    const sunday = lastSunday();
    const dates = [];
    for (let i = 0; i < WEEKS; i++) {
      const d = new Date(sunday);
      d.setDate(d.getDate() - i * 7);
      dates.push(ymd(d));
    }

    const found = [];
    for (let i = 0; i < dates.length; i += BATCH) {
      const chunk = dates.slice(i, i + BATCH);
      const got = await Promise.all(chunk.map((d) => fetchWeek(key, d, code)));
      got.forEach((g) => { if (g) found.push(g); });
    }

    // 같은 적용일이 겹칠 수 있으므로 정리하고 오름차순으로
    const uniq = [...new Map(found.map((f) => [f.date, f])).values()]
      .filter((f) => f.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (uniq.length === 0) {
      res.status(502).json({ ok: false, error: '이력 데이터를 찾지 못했습니다.' });
      return;
    }

    const values = uniq.map((u) => u.rate);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    res.status(200).json({
      ok: true,
      code,
      basis: '수입 과세환율',
      source: '관세청 · 공공데이터포털',
      points: uniq,
      min: Math.min(...values),
      max: Math.max(...values),
      first: values[0],
      last: values[values.length - 1],
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
}
