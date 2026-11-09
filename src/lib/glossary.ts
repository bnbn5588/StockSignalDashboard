// Plain-language definitions shown by <Term> wherever these words appear.
export const GLOSSARY: Record<string, { en: string; th: string }> = {
  BUY: {
    en: 'BUY: the stock is in an uptrend — above its 200-day average, with short-term trend and buyers both up. A trend to follow, not a promise it will rise.',
    th: 'BUY: หุ้นอยู่ในแนวโน้มขาขึ้น — ราคาอยู่เหนือเส้นค่าเฉลี่ย 200 วัน และแนวโน้มระยะสั้นกับแรงซื้อเป็นขาขึ้นทั้งคู่ เป็นแนวโน้มที่ตามได้ ไม่ได้รับประกันว่าราคาจะขึ้น',
  },
  SELL: {
    en: 'SELL: the uptrend is broken — exit or stay out. It is not a prediction of how far the price will fall.',
    th: 'SELL: แนวโน้มขาขึ้นเสียแล้ว — ควรออกหรืออยู่นอกตลาดไว้ก่อน ไม่ได้ทำนายว่าราคาจะลงไปอีกเท่าไร',
  },
  HOLD: {
    en: 'HOLD: the long-term uptrend is intact but the short-term trend is mixed — no new action.',
    th: 'HOLD: แนวโน้มขาขึ้นระยะยาวยังอยู่ แต่ระยะสั้นยังไม่ชัด — ยังไม่ต้องทำอะไรเพิ่ม',
  },
  favor: {
    en: 'favor: a trend worth following — reasonable to hold or buy. Given to a top pick, unless major news goes against it.',
    th: 'favor: แนวโน้มน่าติดตาม — ถือต่อหรือซื้อได้อย่างสมเหตุสมผล ให้กับ top pick เว้นแต่มีข่าวใหญ่ที่ขัดกับสัญญาณ',
  },
  caution: {
    en: 'caution: avoid, reduce or wait. Given to every risk-watch ticker (good news alone does not override a broken trend), and to a top pick hit by major news against it.',
    th: 'caution: หลีกเลี่ยง ลดสัดส่วน หรือรอดูก่อน ให้กับหุ้นใน risk watch ทุกตัว (ข่าวดีอย่างเดียวไม่พอจะลบล้างแนวโน้มที่เสีย) และกับ top pick ที่เจอข่าวใหญ่ซึ่งขัดกับสัญญาณ',
  },
  agree: {
    en: 'Agree: how many of the engine\'s 5 trend checks point the same way — 20 = 3 of 5, 60 = 4 of 5, 100 = all 5. How clear the trend is, not a win probability.',
    th: 'Agree: จำนวนตัวชี้วัดแนวโน้ม 5 ตัวของระบบที่ชี้ไปทางเดียวกัน — 20 = 3 ใน 5, 60 = 4 ใน 5, 100 = ครบ 5 บอกว่าแนวโน้มชัดแค่ไหน ไม่ใช่โอกาสชนะ',
  },
  adx: {
    en: 'ADX: trend strength, whatever the direction. Below 20 = weak or no trend, 20–25 = developing, above 25 = strong.',
    th: 'ADX: ความแข็งแรงของแนวโน้ม ไม่สนทิศทาง ต่ำกว่า 20 = อ่อนหรือไม่มีแนวโน้ม, 20–25 = กำลังก่อตัว, เกิน 25 = แข็งแรง',
  },
  di: {
    en: '+DI / −DI: buying vs selling pressure. +DI above −DI = buyers lead (green); −DI above +DI = sellers lead (red). The bigger the gap, the clearer the direction.',
    th: '+DI / −DI: แรงซื้อเทียบแรงขาย +DI สูงกว่า = ฝั่งซื้อนำ (เขียว), −DI สูงกว่า = ฝั่งขายนำ (แดง) ยิ่งห่างกันมาก ทิศทางยิ่งชัด',
  },
  regime: {
    en: 'Regime: UP when the price is above its 200-day average (long-term uptrend), DOWN when below.',
    th: 'Regime: UP เมื่อราคาอยู่เหนือเส้นค่าเฉลี่ย 200 วัน (แนวโน้มขาขึ้นระยะยาว), DOWN เมื่ออยู่ใต้เส้น',
  },
  streak: {
    en: 'Streak: how many trading days in a row the signal has stayed the same. Long = the trend has held for a while; it is not a confidence measure.',
    th: 'Streak: จำนวนวันทำการติดต่อกันที่สัญญาณไม่เปลี่ยน ยาว = แนวโน้มคงอยู่มานาน แต่ไม่ได้บอกความมั่นใจ',
  },
  earnings: {
    en: 'Earnings: the company\'s quarterly results report. The price can jump either way on the day, which the trend signal cannot anticipate.',
    th: 'Earnings: วันประกาศผลประกอบการรายไตรมาส ราคาอาจกระโดดขึ้นหรือลงแรงในวันนั้น ซึ่งสัญญาณแนวโน้มคาดการณ์ไม่ได้',
  },
  winRate: {
    en: 'Win rate: share of completed BUY→SELL trades that made money.',
    th: 'Win rate: สัดส่วนของการซื้อ→ขายที่จบแล้วและได้กำไร',
  },
  expectancy: {
    en: 'Expectancy: the average % gain or loss per completed trade — win rate and the size of wins and losses combined.',
    th: 'Expectancy: กำไรหรือขาดทุนเฉลี่ย (%) ต่อการเทรดหนึ่งครั้ง — รวมทั้งอัตราชนะและขนาดของกำไร/ขาดทุน',
  },
  drawdown: {
    en: 'Max drawdown: the largest fall from a peak to a later low. Smaller = less painful to hold.',
    th: 'Max drawdown: การร่วงลงจากจุดสูงสุดไปจุดต่ำสุดครั้งใหญ่ที่สุด ยิ่งน้อยยิ่งถือได้สบายใจ',
  },
  buyHold: {
    en: 'Buy-and-hold: buying on the first day and never selling — the baseline the strategy is compared with.',
    th: 'Buy-and-hold: ซื้อวันแรกแล้วถือยาวไม่ขาย — ใช้เป็นเกณฑ์เทียบกับกลยุทธ์',
  },
  spy: {
    en: 'SPY: an ETF that tracks the S&P 500 — the US market as a whole, used as the benchmark.',
    th: 'SPY: กองทุน ETF ที่ตามดัชนี S&P 500 — ตัวแทนตลาดหุ้นสหรัฐฯ โดยรวม ใช้เป็นเกณฑ์เทียบ',
  },
  hitRate: {
    en: 'Hit rate: share of calls that went the right way vs SPY. 50% is a coin flip.',
    th: 'Hit rate: สัดส่วนของคำแนะนำที่ไปถูกทางเมื่อเทียบกับ SPY 50% เท่ากับโยนเหรียญ',
  },
};
