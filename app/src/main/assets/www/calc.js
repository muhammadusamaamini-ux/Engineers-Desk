/* Engineer's Desk — structural calculators (SI units, ACI 318-19 / AISC 360-16) */
'use strict';
const BARS = [
  ['#3', 9.5, 71], ['#4', 12.7, 129], ['#5', 15.9, 199], ['#6', 19.1, 284], ['#7', 22.2, 387], ['#8', 25.4, 510],
  ['#9', 28.7, 645], ['#10', 32.3, 819], ['#11', 35.8, 1006], ['10 mm', 10, 78.5], ['12 mm', 12, 113], ['16 mm', 16, 201],
  ['20 mm', 20, 314], ['25 mm', 25, 491], ['32 mm', 32, 804]];
const BAROPTS = BARS.map(b => [b[0], `${b[0]} (Ø${b[1]} mm, ${b[2]} mm²)`]);
const bar = k => { const b = BARS.find(x => x[0] === k) || BARS[2]; return { n: b[0], d: b[1], A: b[2] }; };
const FC = [['17', '17 MPa (2500 psi)'], ['21', '21 MPa (3000 psi)'], ['25', '25 MPa (3600 psi)'], ['28', '28 MPa (4000 psi)'], ['32', '32 MPa (4600 psi)'], ['35', '35 MPa (5000 psi)'], ['40', '40 MPa (5800 psi)']];
const FY = [['280', 'Grade 40 — 280 MPa'], ['420', 'Grade 60 — 420 MPa'], ['520', 'Grade 75 — 520 MPa']];
const fx = (x, n = 2) => (x == null || isNaN(x)) ? '—' : (Math.abs(x) < 1e-9 ? 0 : Number(x)).toLocaleString('en-US', { maximumFractionDigits: n, minimumFractionDigits: 0 });
const ceil = (x, s) => Math.ceil(x / s - 1e-9) * s;
const beta1 = fc => fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 28) / 7);
const interp = (x, xs, ys) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[ys.length - 1]; };

/* flexure helper: required As for Mu (kN·m), b,d (mm) */
function flexAs(Mu, b, d, fc, fy) {
  const Mn = Mu * 1e6 / 0.9;
  const Rn = Mn / (b * d * d);
  const disc = 1 - 2 * Rn / (0.85 * fc);
  if (disc < 0) return null;
  return 0.85 * fc / fy * (1 - Math.sqrt(disc)) * b * d;
}

const CALCS = [
/* ---------------- CONCRETE ---------------- */
{ id: 'mix', g: 'Concrete', t: 'Nominal mix quantities (1:2:4 etc.)', d: 'Cement bags, sand, aggregate and water for a volume of wet concrete — with the dry-volume factor and wastage, so site quantities are not short.',
  inputs: [
    { k: 'V', l: 'Wet (finished) concrete volume', u: 'm³', v: 1 },
    { k: 'mix', l: 'Mix ratio  cement : sand : aggregate', o: [['1:1:2', '1:1:2 (M25 nominal)'], ['1:1.5:3', '1:1.5:3 (M20)'], ['1:2:4', '1:2:4 (M15 / ≈ 3000 psi field mix)'], ['1:3:6', '1:3:6 (M10)'], ['1:4:8', '1:4:8 (lean / M7.5)'], ['custom', 'Custom ratio']], v: '1:2:4' },
    { k: 'c', l: 'Custom: cement part', v: 1, show: v => v.mix === 'custom' }, { k: 's', l: 'Custom: sand parts', v: 2, show: v => v.mix === 'custom' }, { k: 'a', l: 'Custom: aggregate parts', v: 4, show: v => v.mix === 'custom' },
    { k: 'f', l: 'Dry-volume factor (wet → dry)', v: 1.54, h: '1.52–1.57 for concrete: voids fill when water is added, so ~54% more dry material is needed.' },
    { k: 'wst', l: 'Wastage allowance', u: '%', v: 2.5 },
    { k: 'wc', l: 'Water–cement ratio', v: 0.5 },
    { k: 'bag', l: 'Cement bag', u: 'kg', v: 50 }],
  run(v) {
    const [c, s, a] = v.mix === 'custom' ? [v.c, v.s, v.a] : v.mix.split(':').map(Number);
    const sum = c + s + a, dry = v.V * v.f * (1 + v.wst / 100);
    const Vc = dry * c / sum, Vs = dry * s / sum, Va = dry * a / sum;
    const Mc = Vc * 1440, bags = Mc / v.bag, W = Mc * v.wc;
    return {
      res: [['Cement', fx(bags, 1) + ' bags', fx(Mc, 0) + ' kg'], ['Sand', fx(Vs, 3) + ' m³', fx(Vs * 35.315, 1) + ' cft'], ['Coarse aggregate', fx(Va, 3) + ' m³', fx(Va * 35.315, 1) + ' cft'], ['Water', fx(W, 0) + ' litres', ''], ['Dry volume of materials', fx(dry, 3) + ' m³', '']],
      steps: [`Dry volume = wet volume × dry factor × (1 + wastage) = ${v.V} × ${v.f} × ${fx(1 + v.wst / 100, 3)} = <b>${fx(dry, 3)} m³</b>`,
        `Sum of ratio = ${c} + ${s} + ${a} = ${sum}`,
        `Cement = ${fx(dry, 3)} × ${c}/${sum} = ${fx(Vc, 4)} m³ × 1440 kg/m³ = ${fx(Mc, 0)} kg = ${fx(bags, 2)} bags of ${v.bag} kg (1 bag ≈ 0.0347 m³ ≈ 1.25 cft)`,
        `Sand = ${fx(dry, 3)} × ${s}/${sum} = ${fx(Vs, 3)} m³;  Aggregate = ${fx(dry, 3)} × ${a}/${sum} = ${fx(Va, 3)} m³`,
        `Water = w/c × cement = ${v.wc} × ${fx(Mc, 0)} = ${fx(W, 0)} L (adjust for moisture already in sand)`],
      warn: v.f < 1.5 ? ['A dry factor below 1.5 under-estimates materials for concrete.'] : []
    };
  } },

{ id: 'aci211', g: 'Concrete', t: 'Concrete mix design (ACI 211.1)', d: 'Target strength → w/c, water, cement, coarse and fine aggregate per m³ (SSD), plus field batch weights corrected for moisture.',
  inputs: [
    { k: 'fc', l: 'Specified strength f′c', u: 'MPa', v: 21 },
    { k: 'sd', l: 'Standard deviation of site records (0 = no records)', u: 'MPa', v: 0 },
    { k: 'slump', l: 'Slump', o: [['1', '25–50 mm'], ['2', '75–100 mm'], ['3', '150–175 mm']], v: '2' },
    { k: 'nmas', l: 'Max. aggregate size', o: [['9.5', '9.5 mm (3/8″)'], ['12.5', '12.5 mm (1/2″)'], ['19', '19 mm (3/4″)'], ['25', '25 mm (1″)'], ['37.5', '37.5 mm (1½″)'], ['50', '50 mm (2″)']], v: '19' },
    { k: 'air', l: 'Air-entrained?', o: [['0', 'No'], ['1', 'Yes (moderate exposure)']], v: '0' },
    { k: 'fm', l: 'Fineness modulus of sand', v: 2.6 },
    { k: 'druw', l: 'Dry-rodded unit weight of coarse aggregate', u: 'kg/m³', v: 1600 },
    { k: 'gca', l: 'Specific gravity coarse agg. (SSD)', v: 2.68 }, { k: 'gfa', l: 'Specific gravity sand (SSD)', v: 2.64 }, { k: 'gc', l: 'Specific gravity cement', v: 3.15 },
    { k: 'mca', l: 'Coarse agg.: moisture − absorption', u: '%', v: 0, h: 'Free moisture; negative if drier than SSD.' },
    { k: 'mfa', l: 'Sand: moisture − absorption', u: '%', v: 3 }],
  run(v) {
    const fc = v.fc, steps = [], warn = [];
    let fcr;
    if (v.sd > 0) { fcr = fc <= 35 ? Math.max(fc + 1.34 * v.sd, fc + 2.33 * v.sd - 3.5) : Math.max(fc + 1.34 * v.sd, 0.9 * fc + 2.33 * v.sd); steps.push(`Target f′cr (ACI 318 Table 26.4.3.1) with s = ${v.sd}: <b>${fx(fcr, 1)} MPa</b>`); }
    else { fcr = fc < 21 ? fc + 7 : fc <= 35 ? fc + 8.3 : 1.1 * fc + 5; steps.push(`No site records → f′cr = ${fc < 21 ? 'f′c + 7' : fc <= 35 ? 'f′c + 8.3' : '1.10f′c + 5'} = <b>${fx(fcr, 1)} MPa</b>`); }
    const sizes = [9.5, 12.5, 19, 25, 37.5, 50], si = sizes.indexOf(+v.nmas), ae = v.air === '1';
    const WT = ae ? [[181, 175, 168, 160, 150, 142], [202, 193, 184, 175, 165, 157], [216, 205, 197, 184, 174, 166]] : [[207, 199, 190, 179, 166, 154], [228, 216, 205, 193, 181, 169], [243, 228, 216, 202, 190, 178]];
    const W = WT[+v.slump - 1][si];
    const airp = ae ? [7.5, 7, 6, 6, 5.5, 5][si] : [3, 2.5, 2, 1.5, 1, 0.5][si];
    steps.push(`Mixing water (ACI 211.1 Table 6.3.3): <b>${W} kg/m³</b>; air ${ae ? 'recommended' : 'entrapped'} ≈ ${airp}%`);
    const sx = [15, 20, 25, 30, 35, 40], wcn = [0.79, 0.69, 0.61, 0.54, 0.47, 0.42], wca = [0.70, 0.60, 0.52, 0.45, 0.39, 0.35];
    if (fcr > 40) warn.push('f′cr above 40 MPa is outside the ACI 211.1 table — use trial mixes.');
    const wc = interp(fcr, sx, ae ? wca : wcn);
    steps.push(`w/c for f′cr ${fx(fcr, 1)} MPa (Table 6.3.4a, interpolated): <b>${fx(wc, 3)}</b> (also check exposure limits, ACI 318 Table 19.3.2.1)`);
    const C = W / wc; steps.push(`Cement = ${W}/${fx(wc, 3)} = <b>${fx(C, 0)} kg/m³</b> = ${fx(C / 50, 2)} bags`);
    const CAT = [[.50, .48, .46, .44], [.59, .57, .55, .53], [.66, .64, .62, .60], [.71, .69, .67, .65], [.75, .73, .71, .69], [.78, .76, .74, .72]];
    const bv = interp(v.fm, [2.4, 2.6, 2.8, 3.0], CAT[si]);
    const CA = bv * v.druw; steps.push(`Dry-rodded volume of coarse aggregate (Table 6.3.6, FM ${v.fm}): ${fx(bv, 3)} → CA = ${fx(bv, 3)} × ${v.druw} = <b>${fx(CA, 0)} kg/m³</b>`);
    const volW = W / 1000, volC = C / (v.gc * 1000), volCA = CA / (v.gca * 1000), volA = airp / 100;
    const volFA = 1 - volW - volC - volCA - volA, FA = volFA * v.gfa * 1000;
    steps.push(`Absolute volumes: water ${fx(volW, 3)}, cement ${fx(volC, 3)}, CA ${fx(volCA, 3)}, air ${fx(volA, 3)} → sand = 1 − Σ = ${fx(volFA, 3)} m³ × ${v.gfa} × 1000 = <b>${fx(FA, 0)} kg/m³</b>`);
    const FAb = FA * (1 + v.mfa / 100), CAb = CA * (1 + v.mca / 100), Wb = W - FA * v.mfa / 100 - CA * v.mca / 100;
    steps.push(`Field batch: sand ${fx(FA, 0)} × (1 + ${v.mfa}%) = ${fx(FAb, 0)} kg; CA ${fx(CA, 0)} × (1 + ${v.mca}%) = ${fx(CAb, 0)} kg; water ${W} − free water in aggregates = ${fx(Wb, 0)} kg`);
    return {
      res: [['Target strength f′cr', fx(fcr, 1) + ' MPa', ''], ['w/c ratio', fx(wc, 2), ''], ['Cement', fx(C, 0) + ' kg/m³', fx(C / 50, 2) + ' bags'], ['Water (field)', fx(Wb, 0) + ' kg/m³', 'SSD ' + W],
        ['Sand (field)', fx(FAb, 0) + ' kg/m³', 'SSD ' + fx(FA, 0)], ['Coarse agg. (field)', fx(CAb, 0) + ' kg/m³', 'SSD ' + fx(CA, 0)], ['Ratio by weight (SSD)', `1 : ${fx(FA / C, 2)} : ${fx(CA / C, 2)}`, ''],
        ['Per 50 kg bag (field)', `water ${fx(Wb / C * 50, 1)} L · sand ${fx(FAb / C * 50, 0)} kg · agg. ${fx(CAb / C * 50, 0)} kg`, '']],
      steps, warn: warn.concat(volFA < 0.2 ? ['Very little sand — check inputs.'] : [], ['Always confirm with trial batches and cylinder tests.'])
    };
  } },

/* ---------------- QUANTITIES & STEEL ---------------- */
{ id: 'qty', g: 'Quantities & steel', t: 'Member concrete & steel quantity', d: 'Volume of a slab, beam, column or footing (× number) with cement, sand, aggregate and an approximate steel weight.',
  inputs: [
    { k: 'type', l: 'Member', o: [['slab', 'Slab (L × W × thickness)'], ['beam', 'Beam (length × width × depth)'], ['col', 'Rectangular column (b × h × height)'], ['ccol', 'Circular column (dia × height)'], ['ftg', 'Footing (L × B × depth)']], v: 'beam' },
    { k: 'a', l: 'Length / b / diameter', u: 'm', v: 6 }, { k: 'b', l: 'Width / h', u: 'm', v: 0.3, show: v => v.type !== 'ccol' }, { k: 'c', l: 'Thickness / depth / height', u: 'm', v: 0.5 },
    { k: 'n', l: 'Number of members', v: 1 },
    { k: 'mix', l: 'Mix ratio', o: [['1:1.5:3', '1:1.5:3'], ['1:2:4', '1:2:4'], ['1:1:2', '1:1:2'], ['1:3:6', '1:3:6']], v: '1:2:4' },
    { k: 'kg', l: 'Steel per m³ (0 = typical for member)', u: 'kg/m³', v: 0, h: 'Typical: slab 80, beam 130, column 160, footing 70 kg/m³. Use the BBS for exact steel.' }],
  run(v) {
    const vol1 = v.type === 'ccol' ? Math.PI / 4 * v.a * v.a * v.c : v.a * v.b * v.c, V = vol1 * v.n;
    const [c, s, a] = v.mix.split(':').map(Number), sum = c + s + a, dry = V * 1.54 * 1.025;
    const kg = v.kg || { slab: 80, beam: 130, col: 160, ccol: 160, ftg: 70 }[v.type];
    return {
      res: [['Concrete volume', fx(V, 3) + ' m³', fx(V * 35.315, 1) + ' cft'], ['Cement', fx(dry * c / sum * 1440 / 50, 1) + ' bags', ''], ['Sand', fx(dry * s / sum, 3) + ' m³', fx(dry * s / sum * 35.315, 1) + ' cft'],
        ['Aggregate', fx(dry * a / sum, 3) + ' m³', fx(dry * a / sum * 35.315, 1) + ' cft'], ['Steel (approx.)', fx(V * kg, 0) + ' kg', fx(V * kg / 1000, 3) + ' t']],
      steps: [`Volume of one = ${v.type === 'ccol' ? `π/4 × ${v.a}² × ${v.c}` : `${v.a} × ${v.b} × ${v.c}`} = ${fx(vol1, 4)} m³; × ${v.n} = <b>${fx(V, 3)} m³</b>`,
        `Dry materials = ${fx(V, 3)} × 1.54 (dry factor) × 1.025 (wastage) = ${fx(dry, 3)} m³, split ${v.mix}`, `Steel ≈ ${kg} kg/m³ × ${fx(V, 3)} m³ = ${fx(V * kg, 0)} kg`],
      warn: []
    };
  } },

{ id: 'bbs', g: 'Quantities & steel', t: 'Bar bending schedule (cutting length)', d: 'Cutting length and weight of straight, L-bent, cranked bars and stirrups. Add each bar mark to a schedule with totals by diameter.', addable: true,
  inputs: [
    { k: 'shape', l: 'Bar shape', o: [['st', 'Straight bar (with optional 90° bends)'], ['crank', 'Cranked (bent-up) bar — slab/beam'], ['stir', 'Closed stirrup / tie (135° hooks)'], ['lap', 'Straight bar with laps (long runs)']], v: 'st' },
    { k: 'mark', l: 'Bar mark / member', t: 'text', v: 'B1 bottom' },
    { k: 'bar', l: 'Bar', o: BAROPTS, v: '#5' },
    { k: 'L', l: 'Length / clear span (out-to-out)', u: 'mm', v: 4000, show: v => v.shape !== 'stir' },
    { k: 'leg', l: '90° bend leg at each end (0 = none)', u: 'mm', v: 0, show: v => v.shape === 'st' || v.shape === 'crank' },
    { k: 'D', l: 'Member depth (for crank height)', u: 'mm', v: 150, show: v => v.shape === 'crank' },
    { k: 'B', l: 'Member width b', u: 'mm', v: 300, show: v => v.shape === 'stir' }, { k: 'H', l: 'Member depth h', u: 'mm', v: 450, show: v => v.shape === 'stir' },
    { k: 'cov', l: 'Clear cover', u: 'mm', v: 25, show: v => v.shape === 'stir' || v.shape === 'crank' },
    { k: 'hk', l: 'Hook extension rule', o: [['aci', 'ACI 318: 6d (≥ 75 mm)'], ['is', 'IS / common site: 10d']], v: 'aci', show: v => v.shape === 'stir' },
    { k: 'lap', l: 'Lap length (in bar diameters)', v: 50, show: v => v.shape === 'lap' }, { k: 'stock', l: 'Stock bar length', u: 'mm', v: 12000, show: v => v.shape === 'lap' },
    { k: 'n', l: 'Number of bars', v: 10 }],
  run(v) {
    const b = bar(v.bar), d = b.d, steps = [];
    let cl;
    if (v.shape === 'st') {
      const nb = v.leg > 0 ? 2 : 0;
      cl = v.L + 2 * v.leg - nb * 2 * d;
      steps.push(`Cutting length = L + 2 × leg − bend deductions = ${v.L} + 2 × ${v.leg} − ${nb} × 2d (${fx(2 * d, 0)}) = <b>${fx(cl, 0)} mm</b>`);
    } else if (v.shape === 'crank') {
      const Hc = v.D - 2 * v.cov - d, extra = 0.42 * Hc;
      cl = v.L + 2 * v.leg + 2 * extra - 4 * d - (v.leg > 0 ? 2 * 2 * d : 0);
      steps.push(`Crank height H = D − 2 × cover − d = ${v.D} − ${2 * v.cov} − ${fx(d, 1)} = ${fx(Hc, 0)} mm; extra length per 45° crank = 0.42H = ${fx(extra, 0)} mm`);
      steps.push(`Cutting length = L + 2 × leg + 2 × 0.42H − 4 × (45° bend = 1d)${v.leg > 0 ? ' − 2 × (90° bend = 2d)' : ''} = <b>${fx(cl, 0)} mm</b>`);
    } else if (v.shape === 'stir') {
      const a = v.B - 2 * v.cov - d, h = v.H - 2 * v.cov - d, ext = v.hk === 'aci' ? Math.max(6 * d, 75) : 10 * d;
      cl = 2 * (a + h) + 2 * ext - 3 * 2 * d - 2 * 3 * d;
      steps.push(`Centre-line dimensions: a = b − 2c − d = ${fx(a, 0)} mm, h = ${fx(h, 0)} mm`);
      steps.push(`Cutting length = 2(a + h) + 2 × hook (${fx(ext, 0)}) − 3 × 90° bends (2d) − 2 × 135° bends (3d) = <b>${fx(cl, 0)} mm</b>`);
    } else {
      const lap = v.lap * d, nl = Math.max(0, Math.ceil((v.L - v.stock) / (v.stock - lap)));
      cl = v.L + nl * lap;
      steps.push(`Laps needed = ⌈(L − stock)/(stock − lap)⌉ = ${nl}; lap = ${v.lap}d = ${fx(lap, 0)} mm`);
      steps.push(`Length per run = L + laps × lap = <b>${fx(cl, 0)} mm</b>`);
    }
    const kgm = d * d / 162, tot = cl / 1000 * v.n, kg = tot * kgm;
    steps.push(`Unit weight = d²/162 = ${fx(d, 1)}²/162 = ${fx(kgm, 3)} kg/m; total = ${fx(cl / 1000, 3)} m × ${v.n} = ${fx(tot, 2)} m → <b>${fx(kg, 1)} kg</b>`);
    return { res: [['Cutting length', fx(cl, 0) + ' mm', fx(cl / 304.8, 2) + ' ft'], ['Total length', fx(tot, 2) + ' m', ''], ['Weight', fx(kg, 1) + ' kg', fx(kgm, 3) + ' kg/m']], steps, warn: [],
      row: { mark: v.mark, bar: b.n, n: v.n, cl: Math.round(cl), kg } };
  } },

{ id: 'steelwt', g: 'Quantities & steel', t: 'Steel bar weight & area', d: 'Weight per metre (d²/162), weight per bar, bars per tonne, and area of n bars.',
  inputs: [{ k: 'bar', l: 'Bar', o: BAROPTS, v: '#5' }, { k: 'L', l: 'Bar length', u: 'm', v: 12 }, { k: 'n', l: 'Number of bars', v: 1 }],
  run(v) {
    const b = bar(v.bar), kgm = b.d * b.d / 162;
    return { res: [['Weight per metre', fx(kgm, 3) + ' kg/m', fx(kgm * 0.672, 3) + ' lb/ft'], ['Weight per bar', fx(kgm * v.L, 2) + ' kg', ''], ['Bars per tonne', fx(1000 / (kgm * v.L), 1), `of ${v.L} m`], ['Total weight', fx(kgm * v.L * v.n, 1) + ' kg', ''], ['Area of ' + v.n + ' bar(s)', fx(b.A * v.n, 0) + ' mm²', fx(b.A * v.n / 645.16, 2) + ' in²']],
      steps: [`d²/162 = ${b.d}²/162 = ${fx(kgm, 3)} kg/m (steel 7850 kg/m³)`], warn: [] };
  } },

/* ---------------- RCC ---------------- */
{ id: 'beamflex', g: 'RCC design (ACI 318-19)', t: 'Beam flexure — steel area & bars', d: 'Mu → required As, min/max checks, number of bars and fit in one layer; switches to doubly reinforced when needed.',
  inputs: [
    { k: 'Mu', l: 'Factored moment Mu', u: 'kN·m', v: 180 }, { k: 'b', l: 'Width b', u: 'mm', v: 300 }, { k: 'h', l: 'Total depth h', u: 'mm', v: 500 },
    { k: 'cov', l: 'Clear cover', u: 'mm', v: 40 }, { k: 'st', l: 'Stirrup', o: BAROPTS, v: '#3' }, { k: 'bar', l: 'Main bar', o: BAROPTS, v: '#6' },
    { k: 'fc', l: 'f′c', o: FC, v: '21' }, { k: 'fy', l: 'fy', o: FY, v: '420' }, { k: 'agg', l: 'Max aggregate size', u: 'mm', v: 19 }],
  run(v) {
    const fc = +v.fc, fy = +v.fy, mb = bar(v.bar), sb = bar(v.st), steps = [], warn = [];
    const d = v.h - v.cov - sb.d - mb.d / 2; steps.push(`d = h − cover − stirrup − bar/2 = ${v.h} − ${v.cov} − ${sb.d} − ${fx(mb.d / 2, 1)} = <b>${fx(d, 0)} mm</b>`);
    const b1 = beta1(fc), Asmin = Math.max(0.25 * Math.sqrt(fc) / fy, 1.4 / fy) * v.b * d;
    const atc = b1 * 0.375 * d, Mtc = 0.9 * 0.85 * fc * v.b * atc * (d - atc / 2) / 1e6;
    steps.push(`β1 = ${fx(b1, 3)}; tension-controlled limit c = 3d/8 → a = ${fx(atc, 0)} mm, φMn,max (singly) = <b>${fx(Mtc, 1)} kN·m</b>`);
    let As, Asc = 0, note;
    if (v.Mu <= Mtc) {
      As = flexAs(v.Mu, v.b, d, fc, fy);
      const a = As * fy / (0.85 * fc * v.b);
      steps.push(`Singly reinforced: Rn = Mu/(φbd²) = ${fx(v.Mu * 1e6 / (0.9 * v.b * d * d), 3)} MPa; ρ = 0.85f′c/fy[1 − √(1 − 2Rn/0.85f′c)] → As = <b>${fx(As, 0)} mm²</b> (a = ${fx(a, 0)} mm, εt = ${fx(0.003 * (d - a / b1) / (a / b1), 4)} ≥ 0.005 ✔)`);
      note = 'singly reinforced';
    } else {
      const dp = v.cov + sb.d + mb.d / 2, As1 = 0.85 * fc * v.b * atc / fy, Mn2 = v.Mu / 0.9 - Mtc / 0.9;
      const c = atc / b1, fsp = Math.min(fy, 600 * (c - dp) / c);
      Asc = Mn2 * 1e6 / (fsp * (d - dp)); As = As1 + Mn2 * 1e6 / (fy * (d - dp));
      steps.push(`Mu > φMn,max → doubly reinforced. Compression steel at d′ = ${fx(dp, 0)} mm: f′s = 600(c − d′)/c ≤ fy = ${fx(fsp, 0)} MPa`);
      steps.push(`As′ = (Mu/φ − Mn1)/(f′s(d − d′)) = <b>${fx(Asc, 0)} mm²</b>; tension As = As1 + As2 = <b>${fx(As, 0)} mm²</b>`);
      note = 'doubly reinforced'; if (fsp < fy) warn.push('Compression steel does not yield — consider a deeper section.');
    }
    if (!As) return { res: [], steps: ['Section too small for this moment.'], warn: ['Increase b or h.'] };
    const req = Math.max(As, Asmin); if (Asmin > As) steps.push(`As,min = max(0.25√f′c/fy, 1.4/fy)bd = ${fx(Asmin, 0)} mm² governs`);
    const n = Math.max(2, Math.ceil(req / mb.A)), sclr = Math.max(25, mb.d, 4 / 3 * v.agg);
    const space = v.b - 2 * (v.cov + sb.d), fit = Math.floor((space + sclr) / (mb.d + sclr));
    steps.push(`Bars: ${fx(req, 0)}/${mb.A} → <b>${n} ${mb.n}</b> (${n * mb.A} mm²). One layer holds ${fit} bars (clear spacing ≥ ${fx(sclr, 0)} mm)`);
    if (n > fit) warn.push(`${n} bars do not fit in one layer — use two layers (recompute d) or bigger bars.`);
    const res = [['Effective depth d', fx(d, 0) + ' mm', note], ['Required As', fx(req, 0) + ' mm²', 'As,min ' + fx(Asmin, 0)], ['Provide (tension)', `${n} ${mb.n}`, n * mb.A + ' mm²']];
    if (Asc) res.push(['Compression steel', `${Math.max(2, Math.ceil(Asc / mb.A))} ${mb.n}`, fx(Asc, 0) + ' mm² req.']);
    return { res, steps, warn };
  } },

{ id: 'beamshear', g: 'RCC design (ACI 318-19)', t: 'Beam shear — stirrup spacing', d: 'Vu → Vc, Vs, stirrup spacing with ACI maximum spacing and minimum shear steel.',
  inputs: [{ k: 'Vu', l: 'Factored shear Vu (at d from support)', u: 'kN', v: 150 }, { k: 'b', l: 'Web width bw', u: 'mm', v: 300 }, { k: 'd', l: 'Effective depth d', u: 'mm', v: 440 },
    { k: 'fc', l: 'f′c', o: FC, v: '21' }, { k: 'fyt', l: 'Stirrup fyt', o: FY, v: '280' }, { k: 'st', l: 'Stirrup bar', o: BAROPTS, v: '#3' }, { k: 'legs', l: 'Number of legs', v: 2 }],
  run(v) {
    const fc = +v.fc, fy = +v.fyt, sb = bar(v.st), Av = v.legs * sb.A, rt = Math.sqrt(fc), bd = v.b * v.d, steps = [], warn = [];
    const Vc = 0.17 * rt * bd / 1000, phiVc = 0.75 * Vc;
    steps.push(`Vc = 0.17λ√f′c bw d = 0.17 × ${fx(rt, 2)} × ${v.b} × ${v.d} = ${fx(Vc, 1)} kN (valid with Av ≥ Av,min); φVc = <b>${fx(phiVc, 1)} kN</b>`);
    const avmin = Math.max(0.062 * rt, 0.35) * v.b / fy; // mm²/mm
    let s, Vs = 0, smax;
    if (v.Vu <= 0.5 * phiVc) { steps.push(`Vu ≤ ½φVc → stirrups not required by calculation (provide nominal stirrups in beams).`); s = Math.min(v.d / 2, 600); smax = s; }
    else {
      Vs = Math.max(0, v.Vu / 0.75 - Vc);
      const lim = 0.66 * rt * bd / 1000;
      if (Vs > lim) return { res: [['Section', 'TOO SMALL', 'Vs > 0.66√f′c bd']], steps: steps.concat([`Vs required = ${fx(Vs, 1)} kN > 0.66√f′c bw d = ${fx(lim, 1)} kN`]), warn: ['Increase section size or f′c.'] };
      smax = Vs <= 0.33 * rt * bd / 1000 ? Math.min(v.d / 2, 600) : Math.min(v.d / 4, 300);
      const sreq = Vs > 0 ? Av * fy * v.d / (Vs * 1000) : Infinity, smin = Av / avmin;
      steps.push(`Vs = Vu/φ − Vc = ${v.Vu}/0.75 − ${fx(Vc, 1)} = <b>${fx(Vs, 1)} kN</b>`);
      steps.push(`s = Av fyt d / Vs = ${Av} × ${fy} × ${v.d} / ${fx(Vs * 1000, 0)} = ${fx(sreq, 0)} mm; Av,min → s ≤ ${fx(smin, 0)} mm; s,max = ${fx(smax, 0)} mm`);
      s = Math.min(sreq, smin, smax);
    }
    const sp = Math.floor(s / 25) * 25;
    return { res: [['φVc', fx(phiVc, 1) + ' kN', ''], ['Vs required', fx(Vs, 1) + ' kN', ''], ['Stirrups', `${v.legs}-leg ${sb.n} @ ${sp} mm c/c`, 's,max ' + fx(smax, 0) + ' mm']], steps, warn };
  } },

{ id: 'slab1', g: 'RCC design (ACI 318-19)', t: 'One-way slab design', d: 'Thickness (deflection), factored load, moments by ACI coefficients, main and shrinkage steel spacing per metre width.',
  inputs: [{ k: 'L', l: 'Span (short direction, centre to centre)', u: 'm', v: 3.6 }, { k: 'sup', l: 'Support condition', o: [['ss', 'Simply supported'], ['one', 'One end continuous'], ['both', 'Both ends continuous'], ['cant', 'Cantilever']], v: 'one' },
    { k: 'h', l: 'Thickness h (0 = auto from deflection rule)', u: 'mm', v: 0 }, { k: 'sdl', l: 'Superimposed dead load (floor finish, partitions)', u: 'kPa', v: 1.5 }, { k: 'll', l: 'Live load', u: 'kPa', v: 2.0 },
    { k: 'fc', l: 'f′c', o: FC, v: '21' }, { k: 'fy', l: 'fy', o: FY, v: '420' }, { k: 'bar', l: 'Main bar', o: BAROPTS, v: '#4' }, { k: 'cov', l: 'Clear cover', u: 'mm', v: 20 }],
  run(v) {
    const fc = +v.fc, fy = +v.fy, b = bar(v.bar), steps = [], warn = [], Lmm = v.L * 1000;
    const div = { ss: 20, one: 24, both: 28, cant: 10 }[v.sup], mod = 0.4 + fy / 700, hmin = Lmm / div * mod;
    const h = v.h || ceil(Math.max(hmin, 100), 5);
    steps.push(`h,min (ACI Table 7.3.1.1) = l/${div} × (0.4 + fy/700) = ${fx(hmin, 0)} mm → use <b>h = ${h} mm</b>`);
    if (v.h && v.h < hmin) warn.push(`h = ${v.h} mm is below the deflection rule (${fx(hmin, 0)} mm) — check deflection.`);
    const DL = 24 * h / 1000 + v.sdl, wu = Math.max(1.2 * DL + 1.6 * v.ll, 1.4 * DL);
    steps.push(`DL = 24 × ${h / 1000} + ${v.sdl} = ${fx(DL, 2)} kPa; wu = 1.2DL + 1.6LL = <b>${fx(wu, 2)} kN/m per m</b>`);
    const co = { ss: [8, 0], one: [11, 9], both: [16, 11], cant: [0, 2] }[v.sup];
    const Mp = co[0] ? wu * v.L * v.L / co[0] : 0, Mn = co[1] ? wu * v.L * v.L / co[1] : 0;
    steps.push(`Moments (ACI 6.5 coefficients, approx.): ${co[0] ? `+M = wuL²/${co[0]} = ${fx(Mp, 2)}` : ''} ${co[1] ? ` −M = wuL²/${co[1]} = ${fx(Mn, 2)}` : ''} kN·m/m`);
    const d = h - v.cov - b.d / 2, Asmin = (fy < 420 ? 0.002 : 0.0018) * 1000 * h, smaxm = Math.min(3 * h, 450);
    const out = [['Thickness h', h + ' mm', 'd = ' + fx(d, 0) + ' mm'], ['Factored load wu', fx(wu, 2) + ' kPa', '']];
    const design = (M, lab) => {
      const As = Math.max(flexAs(M, 1000, d, fc, fy) || NaN, Asmin), s = Math.min(Math.floor(b.A * 1000 / As / 5) * 5, smaxm);
      steps.push(`${lab}: As = ${fx(As, 0)} mm²/m (min ${fx(Asmin, 0)}) → ${b.n} @ ${fx(b.A * 1000 / As, 0)} → use <b>${s} mm</b> (max ${smaxm})`);
      out.push([lab + ' steel', `${b.n} @ ${s} mm c/c`, fx(As, 0) + ' mm²/m']);
    };
    if (Mp) design(Mp, 'Bottom (positive)'); if (Mn) design(Mn, 'Top (negative)');
    const ssh = Math.min(Math.floor(BARS[0][2] * 1000 / Asmin / 5) * 5, 5 * h, 450);
    out.push(['Shrinkage / distribution', `#3 @ ${ssh} mm c/c`, fx(Asmin, 0) + ' mm²/m']);
    steps.push(`Shrinkage & temperature steel = ${fx(Asmin, 0)} mm²/m, spacing ≤ min(5h, 450) mm`);
    const Vu = wu * v.L / (v.sup === 'cant' ? 1 : 2) * 1.15, phiVc = 0.75 * 0.17 * Math.sqrt(fc) * 1000 * d / 1000;
    steps.push(`Shear check: Vu ≈ ${fx(Vu, 1)} kN/m ${Vu <= phiVc ? '≤' : '>'} φVc = ${fx(phiVc, 1)} kN/m ${Vu <= phiVc ? '✔' : '✘'}`);
    if (Vu > phiVc) warn.push('Shear fails — increase thickness.');
    return { res: out, steps, warn };
  } },

{ id: 'column', g: 'RCC design (ACI 318-19)', t: 'Short column — axial load', d: 'Tied or spiral column: size or steel for a factored axial load, bars, ties and a slenderness check.',
  inputs: [{ k: 'Pu', l: 'Factored axial load Pu', u: 'kN', v: 1800 }, { k: 'typ', l: 'Column type', o: [['tied', 'Tied (rectangular)'], ['spiral', 'Spiral (circular)']], v: 'tied' },
    { k: 'b', l: 'Width b (or diameter)', u: 'mm', v: 350 }, { k: 'h', l: 'Depth h (tied only)', u: 'mm', v: 350, show: v => v.typ === 'tied' },
    { k: 'fc', l: 'f′c', o: FC, v: '25' }, { k: 'fy', l: 'fy', o: FY, v: '420' }, { k: 'bar', l: 'Longitudinal bar', o: BAROPTS, v: '#6' },
    { k: 'Lu', l: 'Unsupported length', u: 'm', v: 3.0 }, { k: 'k', l: 'Effective length factor k', v: 1.0 }, { k: 'brace', l: 'Frame', o: [['ns', 'Braced (non-sway)'], ['s', 'Unbraced (sway)']], v: 'ns' }],
  run(v) {
    const fc = +v.fc, fy = +v.fy, b = bar(v.bar), steps = [], warn = [], sp = v.typ === 'spiral';
    const Ag = sp ? Math.PI / 4 * v.b * v.b : v.b * v.h, phi = sp ? 0.75 : 0.65, a = sp ? 0.85 : 0.80;
    const Ast = (v.Pu * 1000 / (phi * a) - 0.85 * fc * Ag) / (fy - 0.85 * fc);
    steps.push(`φPn,max = ${phi} × ${a} × [0.85f′c(Ag − Ast) + fy Ast]; Ag = ${fx(Ag, 0)} mm²`);
    steps.push(`Solve for Ast = (Pu/(φ·${a}) − 0.85f′c Ag)/(fy − 0.85f′c) = ${fx(Ast, 0)} mm²`);
    const Amin = 0.01 * Ag, Amax = 0.08 * Ag, req = Math.max(Ast, Amin);
    if (Ast > Amax) warn.push(`Needs ${fx(Ast / Ag * 100, 1)}% steel (> 8%) — enlarge the column. (Practical limit ≈ 4% for laps.)`);
    const n = Math.max(sp ? 6 : 4, Math.ceil(req / b.A)), nn = sp ? n : (n % 2 ? n + 1 : n);
    steps.push(`Steel = max(${fx(Ast, 0)}, 1% Ag = ${fx(Amin, 0)}) → <b>${nn} ${b.n}</b> (${fx(nn * b.A / Ag * 100, 2)}%)`);
    const tie = b.d > 32 ? bar('#4') : bar('#3'), least = sp ? v.b : Math.min(v.b, v.h), s = Math.floor(Math.min(16 * b.d, 48 * tie.d, least) / 25) * 25;
    const r = sp ? 0.25 * v.b : 0.3 * least, kl = v.k * v.Lu * 1000 / r, lim = v.brace === 'ns' ? 34 : 22;
    steps.push(`Ties: ${tie.n} @ min(16db, 48dt, least dim.) = <b>${s} mm</b>${sp ? ' (spiral pitch 25–75 mm instead)' : ''}`);
    steps.push(`Slenderness kLu/r = ${v.k} × ${v.Lu * 1000}/${fx(r, 0)} = ${fx(kl, 1)} ${kl <= lim ? '≤' : '>'} ${lim} → ${kl <= lim ? 'short column ✔' : 'slender — moment magnification required'}`);
    if (kl > lim) warn.push('Slender column: this calculator covers axial load only. Design for magnified moments.');
    const cap = phi * a * (0.85 * fc * (Ag - nn * b.A) + fy * nn * b.A) / 1000;
    return { res: [['Steel required', fx(req, 0) + ' mm²', fx(req / Ag * 100, 2) + '%'], ['Provide', `${nn} ${b.n}`, fx(nn * b.A, 0) + ' mm²'], ['Ties', `${tie.n} @ ${s} mm`, ''], ['φPn,max with bars', fx(cap, 0) + ' kN', cap >= v.Pu ? '≥ Pu ✔' : '< Pu ✘'], ['kLu/r', fx(kl, 1), kl <= lim ? 'short' : 'slender']], steps, warn };
  } },

{ id: 'footing', g: 'RCC design (ACI 318-19)', t: 'Isolated square footing', d: 'Size from soil pressure, depth from punching and one-way shear (with ACI 318-19 size effect), steel each way.',
  inputs: [{ k: 'D', l: 'Dead load (service)', u: 'kN', v: 600 }, { k: 'L', l: 'Live load (service)', u: 'kN', v: 400 }, { k: 'c', l: 'Square column size', u: 'mm', v: 400 },
    { k: 'q', l: 'Net allowable soil pressure', u: 'kPa', v: 200 }, { k: 'Bset', l: 'Footing width (0 = auto)', u: 'm', v: 0 }, { k: 'fc', l: 'f′c', o: FC, v: '25' }, { k: 'fy', l: 'fy', o: FY, v: '420' }, { k: 'bar', l: 'Bar', o: BAROPTS, v: '#5' }, { k: 'cov', l: 'Bottom cover', u: 'mm', v: 75 }],
  run(v) {
    const fc = +v.fc, fy = +v.fy, b = bar(v.bar), rt = Math.sqrt(fc), steps = [], warn = [];
    const Breq = Math.sqrt((v.D + v.L) / v.q), B = v.Bset || ceil(Breq, 0.05), Pu = Math.max(1.2 * v.D + 1.6 * v.L, 1.4 * v.D), qu = Pu / (B * B), c = v.c / 1000;
    steps.push(`Area = (D + L)/q = ${fx((v.D + v.L) / v.q, 2)} m² → B,req = ${fx(Breq, 2)} m → <b>B = ${fx(B, 2)} m</b> square`); if (B < Breq) warn.push('Chosen width is smaller than required by soil pressure.');
    steps.push(`Pu = 1.2D + 1.6L = ${fx(Pu, 0)} kN → qu = ${fx(qu, 1)} kPa`);
    let d, ok = null;
    for (d = 200; d <= 2000; d += 25) {
      const dm = d / 1000, ls = Math.min(1, Math.sqrt(2 / (1 + 0.004 * d)));
      const bo = 4 * (c + dm) * 1000, Vp = qu * (B * B - (c + dm) ** 2);
      const vcp = Math.min(0.33, 0.17 * (1 + 2 / 1), 0.083 * (40 * d / bo + 2)) * ls * rt, phiVp = 0.75 * vcp * bo * d / 1000;
      const Mu = qu * B * ((B - c) / 2) ** 2 / 2, h = ceil(d + v.cov + b.d, 25);
      const Asr = flexAs(Mu, B * 1000, d, fc, fy) || Infinity, As = Math.max(Asr, 0.0018 * B * 1000 * h), n = Math.ceil(As / b.A);
      const rho = n * b.A / (B * 1000 * d), proj = (B - c) / 2 - dm, V1 = qu * B * Math.max(0, proj);
      const vc1 = Math.min(0.66 * ls * Math.cbrt(rho) * rt, 0.42 * rt), phiV1 = 0.75 * vc1 * B * 1000 * d / 1000;
      if (Vp <= phiVp && V1 <= phiV1) { ok = { d, h, ls, bo, Vp, phiVp, Mu, Asr, As, n, rho, V1, phiV1 }; break; }
    }
    if (!ok) return { res: [], steps, warn: ['No depth up to 2 m works — check loads.'] };
    const o = ok, sp = Math.floor((B * 1000 - 2 * v.cov - b.d) / (o.n - 1));
    steps.push(`Depth found by trial (25 mm steps): <b>d = ${o.d} mm, h = ${o.h} mm</b>; λs = √(2/(1 + 0.004d)) = ${fx(o.ls, 3)}`);
    steps.push(`Punching: bo = ${fx(o.bo, 0)} mm, Vu = ${fx(o.Vp, 0)} kN ≤ φVc = ${fx(o.phiVp, 0)} kN ✔`);
    steps.push(`Moment at face: Mu = qu B ((B − c)/2)²/2 = ${fx(o.Mu, 1)} kN·m → As,req ${fx(o.Asr, 0)} mm², As,min 0.0018Bh → use ${fx(o.As, 0)} mm²`);
    steps.push(`One-way shear at d: Vu = ${fx(o.V1, 0)} kN ≤ φVc = 0.75 × 0.66λs ρw^⅓ √f′c B d = ${fx(o.phiV1, 0)} kN ✔ (ρw = ${fx(o.rho, 5)})`);
    const dow = 0.005 * v.c * v.c;
    steps.push(`Dowels to column ≥ 0.005Ag = ${fx(dow, 0)} mm²`);
    return { res: [['Footing size', `${fx(B, 2)} × ${fx(B, 2)} m`, ''], ['Thickness', `h = ${o.h} mm`, 'd = ' + o.d + ' mm'], ['Steel each way', `${o.n} ${b.n} @ ${sp} mm c/c`, fx(o.n * b.A, 0) + ' mm²'], ['qu (factored)', fx(qu, 1) + ' kPa', '']], steps, warn };
  } },

{ id: 'devlen', g: 'RCC design (ACI 318-19)', t: 'Development & lap length', d: 'Tension development length, Class B lap, standard hook and compression development length.',
  inputs: [{ k: 'bar', l: 'Bar', o: BAROPTS, v: '#5' }, { k: 'fc', l: 'f′c', o: FC, v: '21' }, { k: 'fy', l: 'fy', o: FY, v: '420' },
    { k: 'top', l: 'Top bar (> 300 mm fresh concrete below)?', o: [['0', 'No'], ['1', 'Yes (ψt = 1.3)']], v: '0' },
    { k: 'ep', l: 'Epoxy coated?', o: [['0', 'No'], ['1', 'Yes']], v: '0' },
    { k: 'good', l: 'Spacing/cover', o: [['1', 'Clear spacing ≥ db, cover ≥ db, with min stirrups (or ≥ 2db spacing)'], ['0', 'Other cases']], v: '1' },
    { k: 'conf', l: 'Hook confined by ties/stirrups?', o: [['0', 'No (ψr = 1.6)'], ['1', 'Yes (ψr = 1.0)']], v: '0' }],
  run(v) {
    const b = bar(v.bar), fc = Math.min(+v.fc, 70), fy = +v.fy, rt = Math.sqrt(fc), db = b.d, steps = [];
    const pt = v.top === '1' ? 1.3 : 1, pe = v.ep === '1' ? 1.5 : 1, ptpe = Math.min(pt * pe, 1.7), pg = fy <= 420 ? 1.0 : 1.15;
    const small = db <= 19.1, den = v.good === '1' ? (small ? 2.1 : 1.7) : (small ? 1.4 : 1.1);
    const ld = Math.max(fy * ptpe * pg / (den * rt) * db, 300);
    steps.push(`ld = fy ψt ψe ψg / (${den} λ √f′c) × db = ${fy} × ${fx(ptpe, 2)} × ${pg} / (${den} × ${fx(rt, 2)}) × ${db} = <b>${fx(ld, 0)} mm</b> (≥ 300)`);
    const lap = Math.max(1.3 * ld, 300); steps.push(`Class B tension lap = 1.3 ld = <b>${fx(lap, 0)} mm</b> (Class A = 1.0 ld only if As,prov ≥ 2As,req and ≤ 50% spliced)`);
    const pc = fc < 40 ? fc / 105 + 0.6 : 1, pr = v.conf === '1' ? 1 : 1.6;
    const ldh = Math.max(fy * pe * pr * 1 * pc / (23 * rt) * Math.pow(db, 1.5), 8 * db, 150);
    steps.push(`Hooked bar ldh = fy ψe ψr ψo ψc /(23λ√f′c) × db^1.5 = <b>${fx(ldh, 0)} mm</b> (ψc = ${fx(pc, 2)}, ψr = ${pr})`);
    const ldc = Math.max(Math.max(0.24 * fy / rt, 0.043 * fy) * db, 200);
    steps.push(`Compression ldc = max(0.24fy/λ√f′c, 0.043fy) db = <b>${fx(ldc, 0)} mm</b>; compression lap = max(0.071fy db, 300) = ${fx(Math.max(0.071 * fy * db, 300), 0)} mm`);
    return { res: [['Tension ld', fx(ld, 0) + ' mm', fx(ld / db, 0) + 'db'], ['Tension lap (Class B)', fx(lap, 0) + ' mm', fx(lap / db, 0) + 'db'], ['Hooked ldh', fx(ldh, 0) + ' mm', ''], ['Compression ldc', fx(ldc, 0) + ' mm', '']], steps, warn: [] };
  } },

{ id: 'minh', g: 'RCC design (ACI 318-19)', t: 'Minimum depth (deflection control)', d: 'ACI minimum thickness for beams, one-way slabs and two-way flat slabs without calculating deflection.',
  inputs: [{ k: 'mem', l: 'Member', o: [['beam', 'Beam / rib'], ['slab', 'One-way solid slab'], ['flat', 'Two-way slab without interior beams']], v: 'beam' },
    { k: 'L', l: 'Span (c/c; clear span ln for two-way)', u: 'm', v: 6 },
    { k: 'sup', l: 'Support', o: [['ss', 'Simply supported'], ['one', 'One end continuous'], ['both', 'Both ends continuous'], ['cant', 'Cantilever']], v: 'one', show: v => v.mem !== 'flat' },
    { k: 'pan', l: 'Panel (two-way)', o: [['ext', 'Exterior panel, no edge beams'], ['extb', 'Exterior panel with edge beams'], ['int', 'Interior panel']], v: 'int', show: v => v.mem === 'flat' },
    { k: 'fy', l: 'fy', o: FY, v: '420' }],
  run(v) {
    const fy = +v.fy, L = v.L * 1000, mod = 0.4 + fy / 700; let div, hmin, txt;
    if (v.mem === 'flat') { div = v.pan === 'ext' ? (fy <= 280 ? 33 : fy <= 420 ? 30 : 27) : (fy <= 280 ? 36 : fy <= 420 ? 33 : 30); hmin = Math.max(L / div, 125); txt = `ln/${div} (ACI Table 8.3.1.1), not less than 125 mm`; }
    else { div = v.mem === 'beam' ? { ss: 16, one: 18.5, both: 21, cant: 8 }[v.sup] : { ss: 20, one: 24, both: 28, cant: 10 }[v.sup]; hmin = L / div * mod; txt = `l/${div} × (0.4 + fy/700) (ACI Table ${v.mem === 'beam' ? '9.3.1.1' : '7.3.1.1'})`; }
    return { res: [['Minimum h', fx(hmin, 0) + ' mm', 'use ' + ceil(hmin, 25) + ' mm']], steps: [`h,min = ${txt} = ${fx(hmin, 0)} mm`], warn: ['Valid for normal-weight concrete and members not attached to partitions likely to be damaged by deflection.'] };
  } },

/* ---------------- STEEL ---------------- */
{ id: 'stens', g: 'Steel design (AISC 360-16, LRFD)', t: 'Tension member capacity', d: 'Yielding on gross area and rupture on effective net area.',
  inputs: [{ k: 'Ag', l: 'Gross area Ag', u: 'mm²', v: 2000 }, { k: 'An', l: 'Net area An (after holes)', u: 'mm²', v: 1700 }, { k: 'U', l: 'Shear-lag factor U', v: 0.85 },
    { k: 'gr', l: 'Steel', o: [['250|400', 'A36 (Fy 250, Fu 400 MPa)'], ['345|450', 'A572 Gr 50 / A992 (Fy 345, Fu 450)']], v: '250|400' }],
  run(v) {
    const [Fy, Fu] = v.gr.split('|').map(Number), y = 0.9 * Fy * v.Ag / 1000, r = 0.75 * Fu * v.U * v.An / 1000;
    return { res: [['φPn (governs)', fx(Math.min(y, r), 1) + ' kN', y <= r ? 'yielding' : 'rupture'], ['Yielding 0.9FyAg', fx(y, 1) + ' kN', ''], ['Rupture 0.75FuAe', fx(r, 1) + ' kN', 'Ae = ' + fx(v.U * v.An, 0)]],
      steps: [`Yielding: 0.90 × ${Fy} × ${v.Ag} = ${fx(y, 1)} kN`, `Rupture: 0.75 × ${Fu} × ${v.U} × ${v.An} = ${fx(r, 1)} kN`], warn: ['Also check block shear at the connection.'] };
  } },

{ id: 'scomp', g: 'Steel design (AISC 360-16, LRFD)', t: 'Steel column (flexural buckling)', d: 'Critical stress and design strength φPn from KL/r (AISC Chapter E).',
  inputs: [{ k: 'Ag', l: 'Gross area Ag', u: 'mm²', v: 5000 }, { k: 'r', l: 'Least radius of gyration r', u: 'mm', v: 50 }, { k: 'KL', l: 'Effective length KL', u: 'm', v: 4 },
    { k: 'Fy', l: 'Fy', o: [['250', '250 MPa (A36)'], ['345', '345 MPa (A992)']], v: '250' }],
  run(v) {
    const E = 200000, Fy = +v.Fy, sl = v.KL * 1000 / v.r, Fe = Math.PI ** 2 * E / sl ** 2, lim = 4.71 * Math.sqrt(E / Fy);
    const Fcr = sl <= lim ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe, P = 0.9 * Fcr * v.Ag / 1000;
    return { res: [['φPn', fx(P, 1) + ' kN', ''], ['Fcr', fx(Fcr, 1) + ' MPa', sl <= lim ? 'inelastic' : 'elastic'], ['KL/r', fx(sl, 1), sl > 200 ? '> 200 (not recommended)' : '']],
      steps: [`KL/r = ${v.KL * 1000}/${v.r} = ${fx(sl, 1)}; Fe = π²E/(KL/r)² = ${fx(Fe, 1)} MPa; limit 4.71√(E/Fy) = ${fx(lim, 1)}`,
        sl <= lim ? `Fcr = 0.658^(Fy/Fe) Fy = ${fx(Fcr, 1)} MPa` : `Fcr = 0.877Fe = ${fx(Fcr, 1)} MPa`, `φPn = 0.90 × Fcr × Ag = ${fx(P, 1)} kN`], warn: sl > 200 ? ['KL/r should not exceed 200.'] : [] };
  } },

{ id: 'sconn', g: 'Steel design (AISC 360-16, LRFD)', t: 'Bolt & fillet weld capacity', d: 'Bolt shear and bearing; fillet weld strength per length.',
  inputs: [{ k: 'bd', l: 'Bolt diameter', u: 'mm', v: 20 }, { k: 'bg', l: 'Bolt grade', o: [['372', 'A325 threads included (N): 372 MPa'], ['469', 'A325 threads excluded (X) / A490-N: 469 MPa'], ['579', 'A490 threads excluded (X): 579 MPa']], v: '372' },
    { k: 'nb', l: 'Number of bolts', v: 4 }, { k: 'pl', l: 'Shear planes', v: 1 }, { k: 't', l: 'Thinnest connected plate', u: 'mm', v: 10 }, { k: 'Fu', l: 'Plate Fu', u: 'MPa', v: 400 },
    { k: 'w', l: 'Fillet weld size', u: 'mm', v: 6 }, { k: 'Lw', l: 'Total weld length', u: 'mm', v: 200 }, { k: 'FE', l: 'Electrode FEXX', u: 'MPa', v: 482 }],
  run(v) {
    const Ab = Math.PI / 4 * v.bd ** 2, sh = 0.75 * +v.bg * Ab * v.pl * v.nb / 1000, br = 0.75 * 2.4 * v.bd * v.t * v.Fu * v.nb / 1000;
    const wl = 0.75 * 0.6 * v.FE * 0.707 * v.w * v.Lw / 1000;
    return { res: [['Bolt group (governs)', fx(Math.min(sh, br), 1) + ' kN', sh <= br ? 'shear' : 'bearing'], ['Bolt shear', fx(sh, 1) + ' kN', ''], ['Bearing at holes', fx(br, 1) + ' kN', ''], ['Fillet weld', fx(wl, 1) + ' kN', fx(wl / v.Lw * 1000, 0) + ' kN/m']],
      steps: [`Shear: 0.75 × Fnv × Ab × planes × n = 0.75 × ${v.bg} × ${fx(Ab, 0)} × ${v.pl} × ${v.nb} = ${fx(sh, 1)} kN`, `Bearing: 0.75 × 2.4 d t Fu × n = ${fx(br, 1)} kN (deformation at service a design concern)`, `Weld: 0.75 × 0.60 FEXX × 0.707w × L = ${fx(wl, 1)} kN`], warn: ['Check edge distance/tear-out (1.2 lc t Fu) and base metal shear too.'] };
  } },

/* ---------------- ANALYSIS ---------------- */
{ id: 'beam', g: 'Analysis', t: 'Beam analysis — SFD, BMD, deflection', d: 'Simply supported, cantilever, propped or fixed beam with UDL and up to three point loads.', diagram: true,
  inputs: [{ k: 'sup', l: 'Supports', o: [['ss', 'Simply supported'], ['cant', 'Cantilever (fixed at left)'], ['prop', 'Propped cantilever (fixed left, roller right)'], ['fix', 'Fixed – fixed']], v: 'ss' },
    { k: 'L', l: 'Span L', u: 'm', v: 6 }, { k: 'w', l: 'UDL over full span (incl. self weight)', u: 'kN/m', v: 20 },
    { k: 'P1', l: 'Point load P1', u: 'kN', v: 0 }, { k: 'a1', l: 'P1 distance from left', u: 'm', v: 3 },
    { k: 'P2', l: 'Point load P2', u: 'kN', v: 0 }, { k: 'a2', l: 'P2 distance from left', u: 'm', v: 0 },
    { k: 'P3', l: 'Point load P3', u: 'kN', v: 0 }, { k: 'a3', l: 'P3 distance from left', u: 'm', v: 0 },
    { k: 'E', l: 'Elastic modulus E', u: 'GPa', v: 21.5, h: 'Concrete ≈ 4.7√f′c GPa (21.5 for 21 MPa); steel 200 GPa.' },
    { k: 'I', l: 'Moment of inertia I (0 = from b × h below)', u: '×10⁶ mm⁴', v: 0 }, { k: 'bb', l: 'b (for I)', u: 'mm', v: 300 }, { k: 'hh', l: 'h (for I)', u: 'mm', v: 500 }],
  run(v) {
    const L = v.L, I = (v.I || v.bb * v.hh ** 3 / 12 / 1e6) * 1e6 * 1e-12, EI = v.E * 1e9 * I / 1000; // kN·m²
    const pts = [[v.P1, v.a1], [v.P2, v.a2], [v.P3, v.a3]].filter(p => p[0] && p[1] >= 0 && p[1] <= L);
    const r = beamFE(v.sup, L, v.w, pts, EI);
    const Mmax = r.M.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0), Vmax = r.V.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
    const iM = r.M.indexOf(Mmax), dmax = r.y.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0), iy = r.y.indexOf(dmax);
    const res = [['Left reaction', fx(r.RA, 2) + ' kN', r.MA ? 'M = ' + fx(r.MA, 2) + ' kN·m' : ''], ['Right reaction', fx(r.RB, 2) + ' kN', r.MB ? 'M = ' + fx(r.MB, 2) + ' kN·m' : ''],
      ['Max moment', fx(Mmax, 2) + ' kN·m', 'at x = ' + fx(r.x[iM], 2) + ' m'], ['Max shear', fx(Math.abs(Vmax), 2) + ' kN', ''],
      ['Max deflection', fx(Math.abs(dmax) * 1000, 2) + ' mm', `at x = ${fx(r.x[iy], 2)} m; L/${fx(L / Math.abs(dmax || 1e-9), 0)}`]];
    return { res, steps: [`EI = ${v.E} GPa × ${fx(I * 1e12 / 1e6, 1)}×10⁶ mm⁴ = ${fx(EI, 0)} kN·m²`, 'Solved by the stiffness method with 120 beam elements (exact for these loads at the nodes). Sign: sagging moment positive, deflection downward negative.'], warn: [], svg: beamSVG(r, L) };
  } },

{ id: 'sect', g: 'Analysis', t: 'Section properties', d: 'Area, centroid, moment of inertia, section modulus and radius of gyration.',
  inputs: [{ k: 'sh', l: 'Section', o: [['rect', 'Rectangle'], ['circ', 'Circle'], ['hollow', 'Hollow rectangle (box)'], ['T', 'T-section'], ['I', 'Symmetric I-section']], v: 'rect' },
    { k: 'b', l: 'Width b / flange width / diameter', u: 'mm', v: 300 }, { k: 'h', l: 'Total depth h', u: 'mm', v: 500, show: v => v.sh !== 'circ' },
    { k: 'tf', l: 'Flange thickness tf (T, I) / wall thickness (box)', u: 'mm', v: 120, show: v => ['T', 'I', 'hollow'].includes(v.sh) },
    { k: 'tw', l: 'Web thickness tw (T, I)', u: 'mm', v: 300, show: v => ['T', 'I'].includes(v.sh) }],
  run(v) {
    let A, yb, Ix, Iy; const { b, h, tf, tw } = v;
    if (v.sh === 'rect') { A = b * h; yb = h / 2; Ix = b * h ** 3 / 12; Iy = h * b ** 3 / 12; }
    else if (v.sh === 'circ') { A = Math.PI * b * b / 4; yb = b / 2; Ix = Iy = Math.PI * b ** 4 / 64; }
    else if (v.sh === 'hollow') { const bi = b - 2 * tf, hi = h - 2 * tf; A = b * h - bi * hi; yb = h / 2; Ix = (b * h ** 3 - bi * hi ** 3) / 12; Iy = (h * b ** 3 - hi * bi ** 3) / 12; }
    else if (v.sh === 'T') { const Af = b * tf, Aw = tw * (h - tf); A = Af + Aw; yb = (Af * (h - tf / 2) + Aw * (h - tf) / 2) / A; Ix = b * tf ** 3 / 12 + Af * (h - tf / 2 - yb) ** 2 + tw * (h - tf) ** 3 / 12 + Aw * ((h - tf) / 2 - yb) ** 2; Iy = tf * b ** 3 / 12 + (h - tf) * tw ** 3 / 12; }
    else { const hw = h - 2 * tf; A = 2 * b * tf + tw * hw; yb = h / 2; Ix = (b * h ** 3 - (b - tw) * hw ** 3) / 12; Iy = 2 * tf * b ** 3 / 12 + hw * tw ** 3 / 12; }
    const H = v.sh === 'circ' ? b : h, St = Ix / (H - yb), Sb = Ix / yb;
    return { res: [['Area A', fx(A, 0) + ' mm²', ''], ['Centroid from bottom', fx(yb, 1) + ' mm', ''], ['Ix', fx(Ix / 1e6, 2) + ' ×10⁶ mm⁴', ''], ['Iy', fx(Iy / 1e6, 2) + ' ×10⁶ mm⁴', ''],
      ['Section modulus', `top ${fx(St / 1e3, 1)}, bottom ${fx(Sb / 1e3, 1)}`, '×10³ mm³'], ['rx / ry', `${fx(Math.sqrt(Ix / A), 1)} / ${fx(Math.sqrt(Iy / A), 1)} mm`, '']], steps: ['Parallel-axis theorem: I = Σ(I₀ + A·d²) about the centroidal axis.'], warn: [] };
  } },

/* ---------------- FOUNDATIONS ---------------- */
{ id: 'bearing', g: 'Foundations', t: 'Bearing capacity (Terzaghi)', d: 'Ultimate, net and safe bearing capacity of shallow footings.',
  inputs: [{ k: 'shape', l: 'Footing', o: [['strip', 'Strip (wall) footing'], ['sq', 'Square'], ['circ', 'Circular']], v: 'sq' }, { k: 'B', l: 'Width / diameter B', u: 'm', v: 2 },
    { k: 'Df', l: 'Depth of foundation Df', u: 'm', v: 1.5 }, { k: 'c', l: 'Cohesion c', u: 'kPa', v: 10 }, { k: 'phi', l: 'Friction angle φ', u: '°', v: 30 }, { k: 'g', l: 'Unit weight γ (use γ′ below water table)', u: 'kN/m³', v: 18 }, { k: 'FS', l: 'Factor of safety', v: 3 }],
  run(v) {
    const P = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], NC = [5.70, 7.34, 9.61, 12.86, 17.69, 25.13, 37.16, 57.75, 95.66, 172.28, 347.5], NQ = [1, 1.64, 2.69, 4.45, 7.44, 12.72, 22.46, 41.44, 81.27, 173.28, 415.14], NG = [0, 0.14, 0.56, 1.52, 3.64, 8.34, 19.13, 45.41, 100.39, 297.5, 1153.15];
    const lg = a => a.map(Math.log), Nc = Math.exp(interp(v.phi, P, lg(NC))), Nq = Math.exp(interp(v.phi, P, lg(NQ))), Ng = v.phi <= 0 ? 0 : Math.exp(interp(v.phi, P.slice(1), lg(NG.slice(1))));
    const q = v.g * v.Df, [sc, sg] = { strip: [1, 0.5], sq: [1.3, 0.4], circ: [1.3, 0.3] }[v.shape];
    const qu = sc * v.c * Nc + q * Nq + sg * v.g * v.B * Ng, qnet = qu - q, qs = qnet / v.FS + q;
    return { res: [['Ultimate qu', fx(qu, 0) + ' kPa', ''], ['Net ultimate', fx(qnet, 0) + ' kPa', ''], ['Net safe (allowable)', fx(qnet / v.FS, 0) + ' kPa', 'FS ' + v.FS], ['Gross safe', fx(qs, 0) + ' kPa', '']],
      steps: [`Terzaghi factors for φ = ${v.phi}°: Nc = ${fx(Nc, 2)}, Nq = ${fx(Nq, 2)}, Nγ = ${fx(Ng, 2)}`, `qu = ${sc}cNc + qNq + ${sg}γBNγ = ${sc}×${v.c}×${fx(Nc, 2)} + ${fx(q, 1)}×${fx(Nq, 2)} + ${sg}×${v.g}×${v.B}×${fx(Ng, 2)} = <b>${fx(qu, 0)} kPa</b>`, `Net safe = (qu − γDf)/FS = ${fx(qnet / v.FS, 0)} kPa`],
      warn: ['General shear failure assumed (dense/stiff soil). Also check settlement.'] };
  } },

{ id: 'rwall', g: 'Foundations', t: 'Cantilever retaining wall stability', d: 'Rankine earth pressure, overturning, sliding and base pressure for a trial section.',
  inputs: [{ k: 'H', l: 'Total height H (top of stem to underside of base)', u: 'm', v: 5 }, { k: 'B', l: 'Base width B', u: 'm', v: 3.2 }, { k: 'toe', l: 'Toe length', u: 'm', v: 0.9 },
    { k: 'tt', l: 'Stem thickness at top', u: 'm', v: 0.25 }, { k: 'tb', l: 'Stem thickness at base (back face vertical)', u: 'm', v: 0.4 }, { k: 'tbase', l: 'Base slab thickness', u: 'm', v: 0.45 },
    { k: 'g', l: 'Backfill unit weight γ', u: 'kN/m³', v: 18 }, { k: 'phi', l: 'Backfill φ', u: '°', v: 30 }, { k: 'mu', l: 'Base friction coefficient μ', v: 0.5 }, { k: 'q', l: 'Surcharge on backfill', u: 'kPa', v: 0 }, { k: 'qa', l: 'Allowable soil pressure', u: 'kPa', v: 150 }],
  run(v) {
    const r = Math.PI / 180 * v.phi, Ka = (1 - Math.sin(r)) / (1 + Math.sin(r)), hs = v.H - v.tbase, heel = v.B - v.toe - v.tb;
    const Pa = 0.5 * Ka * v.g * v.H ** 2, Pq = Ka * v.q * v.H, MO = Pa * v.H / 3 + Pq * v.H / 2, PH = Pa + Pq;
    const items = [['Base slab', v.B * v.tbase * 24, v.B / 2], ['Stem (rectangle)', v.tt * hs * 24, v.toe + (v.tb - v.tt) + v.tt / 2], ['Stem (triangle)', 0.5 * (v.tb - v.tt) * hs * 24, v.toe + 2 / 3 * (v.tb - v.tt)], ['Soil on heel', heel * hs * v.g, v.B - heel / 2], ['Surcharge on heel', heel * v.q, v.B - heel / 2]].filter(x => x[1] > 0);
    const SV = items.reduce((a, x) => a + x[1], 0), MR = items.reduce((a, x) => a + x[1] * x[2], 0);
    const FOo = MR / MO, FOs = v.mu * SV / PH, xb = (MR - MO) / SV, e = v.B / 2 - xb, qmax = SV / v.B * (1 + 6 * e / v.B), qmin = SV / v.B * (1 - 6 * e / v.B);
    const warn = [];
    if (FOo < 2) warn.push('Overturning FOS < 2.0.'); if (FOs < 1.5) warn.push('Sliding FOS < 1.5 — widen base or add a shear key.'); if (e > v.B / 6) warn.push('e > B/6 — tension under the heel.'); if (qmax > v.qa) warn.push('qmax exceeds allowable soil pressure.');
    return { res: [['Ka', fx(Ka, 3), ''], ['Overturning FOS', fx(FOo, 2), FOo >= 2 ? '✔' : '✘'], ['Sliding FOS', fx(FOs, 2), FOs >= 1.5 ? '✔' : '✘'], ['Eccentricity e', fx(e, 2) + ' m', e <= v.B / 6 ? '≤ B/6 ✔' : '> B/6 ✘'], ['qmax / qmin', `${fx(qmax, 0)} / ${fx(qmin, 0)} kPa`, qmax <= v.qa ? '≤ qa ✔' : '> qa ✘']],
      steps: [`Ka = (1 − sinφ)/(1 + sinφ) = ${fx(Ka, 3)}; Pa = ½KaγH² = ${fx(Pa, 1)} kN/m at H/3${v.q ? `; surcharge Ka q H = ${fx(Pq, 1)} kN/m at H/2` : ''} → MO = <b>${fx(MO, 1)} kN·m/m</b>`]
        .concat(items.map(x => `${x[0]}: ${fx(x[1], 1)} kN × ${fx(x[2], 3)} m = ${fx(x[1] * x[2], 1)} kN·m`), [`ΣV = ${fx(SV, 1)} kN; ΣMR = ${fx(MR, 1)} kN·m`, `x̄ = (ΣMR − MO)/ΣV = ${fx(xb, 2)} m; e = B/2 − x̄ = ${fx(e, 2)} m`]), warn };
  } },

/* ---------------- UNITS ---------------- */
{ id: 'units', g: 'Analysis', t: 'Structural unit converter', d: 'psi ↔ MPa, kip ↔ kN, kip·ft ↔ kN·m, ksf ↔ kPa, in² ↔ mm² and more.',
  inputs: [{ k: 'x', l: 'Value', v: 3000 }, { k: 'u', l: 'Convert', o: [['psi', 'psi → MPa'], ['mpa', 'MPa → psi'], ['kip', 'kip → kN'], ['kn', 'kN → kip'], ['kft', 'kip·ft → kN·m'], ['knm', 'kN·m → kip·ft'], ['ksf', 'ksf → kPa'], ['kpa', 'kPa → ksf'], ['tsf', 'ton/ft² → kPa'], ['in2', 'in² → mm²'], ['plf', 'lb/ft → kN/m'], ['psf', 'psf → kPa']], v: 'psi' }],
  run(v) {
    const f = { psi: [0.006895, 'MPa'], mpa: [145.04, 'psi'], kip: [4.448, 'kN'], kn: [0.2248, 'kip'], kft: [1.3558, 'kN·m'], knm: [0.7376, 'kip·ft'], ksf: [47.88, 'kPa'], kpa: [0.020885, 'ksf'], tsf: [95.76, 'kPa'], in2: [645.16, 'mm²'], plf: [0.014594, 'kN/m'], psf: [0.04788, 'kPa'] }[v.u];
    return { res: [['Result', fx(v.x * f[0], 4) + ' ' + f[1], '']], steps: [`× ${f[0]}`], warn: [] };
  } },
];

/* ---------- beam stiffness solver ---------- */
function beamFE(sup, L, w, pts, EI) {
  const xs = new Set(); const n0 = 120; for (let i = 0; i <= n0; i++) xs.add(+(L * i / n0).toFixed(6)); pts.forEach(p => xs.add(+p[1].toFixed(6)));
  const x = [...xs].sort((a, b) => a - b), n = x.length, N = 2 * n;
  const K = Array.from({ length: N }, () => new Float64Array(N)), F = new Float64Array(N);
  for (let e = 0; e < n - 1; e++) {
    const l = x[e + 1] - x[e]; if (l <= 0) continue;
    const k = EI / l ** 3, m = [[12, 6 * l, -12, 6 * l], [6 * l, 4 * l * l, -6 * l, 2 * l * l], [-12, -6 * l, 12, -6 * l], [6 * l, 2 * l * l, -6 * l, 4 * l * l]];
    const id = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[id[i]][id[j]] += k * m[i][j];
    const fe = [-w * l / 2, -w * l * l / 12, -w * l / 2, w * l * l / 12];
    for (let i = 0; i < 4; i++) F[id[i]] += fe[i];
  }
  pts.forEach(([P, a]) => { const i = x.findIndex(q => Math.abs(q - a) < 1e-6); F[2 * i] -= P; });
  const fixed = { ss: [0, N - 2], cant: [0, 1], prop: [0, 1, N - 2], fix: [0, 1, N - 2, N - 1] }[sup];
  const free = [...Array(N).keys()].filter(i => !fixed.includes(i));
  const A = free.map(i => free.map(j => K[i][j])), bvec = free.map(i => F[i]);
  const u = gauss(A, bvec), D = new Float64Array(N); free.forEach((i, k) => D[i] = u[k]);
  const R = new Float64Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += K[i][j] * D[j]; R[i] = s - F[i]; }
  // internal forces by statics from the left (sagging moment positive, upward reaction positive)
  const RA = R[0], MAc = R[1], RB = R[N - 2];
  const V = [], M = [], y = [];
  for (let i = 0; i < n; i++) {
    const xi = x[i]; let v = RA - w * xi, m = RA * xi - w * xi * xi / 2 - MAc;
    pts.forEach(([P, a]) => { if (a < xi - 1e-9) { v -= P; m -= P * (xi - a); } });
    V.push(v); M.push(m); y.push(D[2 * i]);
  }
  const fixL = sup !== 'ss', fixR = sup === 'fix';
  return { x, V, M, y, RA, RB, MA: fixL ? M[0] : 0, MB: fixR ? M[n - 1] : 0 };
}
function gauss(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];[b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; if (!f) continue; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}
function beamSVG(r, L) {
  const W = 340, H = 110, pad = 10;
  const plot = (arr, col, lab, unit, invert) => {
    const mx = Math.max(...arr.map(Math.abs)) || 1;
    const pts = r.x.map((xi, i) => [pad + xi / L * (W - 2 * pad), H / 2 - (invert ? -1 : 1) * arr[i] / mx * (H / 2 - 14)]);
    const path = 'M' + pad + ',' + H / 2 + ' ' + pts.map(p => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + ' L' + (W - pad) + ',' + H / 2 + 'Z';
    const iMax = arr.reduce((bi, v, i) => Math.abs(v) > Math.abs(arr[bi]) ? i : bi, 0);
    return `<div class="mut">${lab}</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;background:var(--card2);border-radius:10px;margin:4px 0 10px">
      <line x1="${pad}" y1="${H / 2}" x2="${W - pad}" y2="${H / 2}" stroke="var(--mut)" stroke-width="1"/>
      <path d="${path}" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="1.6"/>
      <text x="${Math.min(W - 60, Math.max(4, pts[iMax][0] - 20))}" y="${Math.max(11, Math.min(H - 3, pts[iMax][1] + (pts[iMax][1] < H / 2 ? -3 : 12)))}" font-size="11" fill="var(--ink)">${fx(arr[iMax], 2)} ${unit}</text></svg>`;
  };
  return plot(r.V, '#4f8cff', 'Shear force diagram', 'kN', false) + plot(r.M, '#f5b041', 'Bending moment diagram (sagging plotted below the axis)', 'kN·m', true) + plot(r.y.map(z => z * 1000), '#2ecc71', 'Deflected shape', 'mm', false);
}
