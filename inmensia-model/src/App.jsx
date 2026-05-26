import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";

const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M€`
  : n >= 1_000   ? `${Math.round(n / 1_000)}K€`
  : `${Math.round(n)}€`;

const fmtM  = (n) => `${(n / 1_000_000).toFixed(3)}M€`;
const pct   = (n) => `${(n * 100).toFixed(1)}%`;
const fmtX  = (n) => `${n.toFixed(2)}×`;

const YEARS = ["Año 1", "Año 2", "Año 3", "Año 4", "Año 5"];

/* ─── COMMUNITY SERVICES (default values) ─── */
const COMMUNITY_SERVICES_DEF = [
  { id:"luz",   name:"Luz zonas comunes",     penet:0.70, prima:800,    margen:0.10, conv:[0.05,0.20,0.35,0.45,0.55], deltaTAM:0.03 },
  { id:"gas_c", name:"Gas comunitario",        penet:0.10, prima:5000,   margen:0.10, conv:[0,0.05,0.10,0.20,0.30],   deltaTAM:0.03 },
  { id:"tel_c", name:"Telefonía comunidad",    penet:0.40, prima:600,    margen:0.10, conv:[0.05,0.25,0.40,0.50,0.60], deltaTAM:0.03 },
  { id:"int_c", name:"Internet comunidad",     penet:0.30, prima:500,    margen:0.10, conv:[0,0.05,0.10,0.20,0.30],   deltaTAM:0.03 },
  { id:"asc",   name:"Ascensores",             penet:0.47, prima:1200,   margen:0.10, conv:[0.05,0.25,0.40,0.50,0.60], deltaTAM:0.03 },
  { id:"ext",   name:"Extintores",             penet:1.00, prima:120,    margen:0.10, conv:[0.10,0.30,0.50,0.55,0.65], deltaTAM:0.03 },
  { id:"ocas",  name:"OCAs",                   penet:1.00, prima:100,    margen:0.15, conv:[0,0.10,0.25,0.40,0.50],   deltaTAM:0.03 },
  { id:"datos", name:"Protección de datos",    penet:1.00, prima:60,     margen:0.50, conv:[0.20,0.45,0.60,0.75,0.85], deltaTAM:0.03 },
  { id:"prl",   name:"PRL-CAE",                penet:1.00, prima:150,    margen:0.40, conv:[0.20,0.45,0.60,0.75,0.85], deltaTAM:0.03 },
  { id:"cert",  name:"Certificados digitales", penet:1.00, prima:50,     margen:0.20, conv:[0.25,0.45,0.55,0.65,0.75], deltaTAM:0.03 },
  { id:"font",  name:"Fontanería",             penet:0.40, prima:500,    margen:0.10, conv:[0.10,0.25,0.45,0.50,0.55], deltaTAM:0.03 },
  { id:"obras", name:"Obras",                  penet:0.35, prima:1800,   margen:0.10, conv:[0.05,0.15,0.25,0.35,0.45], deltaTAM:0.03 },
  { id:"limp",  name:"Limpieza",               penet:0.65, prima:180,    margen:0.10, conv:[0.10,0.25,0.40,0.50,0.55], deltaTAM:0.03 },
  { id:"seg_c", name:"Seguridad",              penet:0.20, prima:400,    margen:0.15, conv:[0.05,0.20,0.35,0.45,0.55], deltaTAM:0.03 },
  { id:"rc",    name:"Seguros RC comunidad",   penet:0.90, prima:1200,   margen:0.15, conv:[0.15,0.35,0.50,0.60,0.70], deltaTAM:0.03 },
];

/* ─── PROPERTY SERVICES (default values) ─── */
const PROPERTY_SERVICES_DEF = [
  { id:"gas_p", name:"Gas propietarios",       penet:0.35, prima:800,    margen:0.08, conv:[0,0,0.03,0.06,0.10],       deltaTAM:0.03 },
  { id:"ene",   name:"Energía propietarios",    penet:0.80, prima:800,    margen:0.08, conv:[0.01,0.03,0.06,0.10,0.15], deltaTAM:0.03 },
  { id:"int_p", name:"Internet propietarios",  penet:0.60, prima:600,    margen:0.05, conv:[0.01,0.02,0.04,0.07,0.10], deltaTAM:0.03 },
  { id:"alarm", name:"Alarmas propietarios",   penet:0.25, prima:600,    margen:0.08, conv:[0,0.01,0.03,0.07,0.12],    deltaTAM:0.03 },
  { id:"seg_h", name:"Seguros hogar",          penet:0.85, prima:300,    margen:0.10, conv:[0.01,0.02,0.05,0.08,0.12], deltaTAM:0.03 },
  { id:"inmob", name:"Asesoría / inmobiliaria",penet:0.04, prima:150000, margen:0.03, conv:[0,0.005,0.01,0.025,0.04],  deltaTAM:0.03 },
];

const DEFAULTS = {
  ccpp:        1500,
  growthRates: [0.02, 0.03, 0.04, 0.05],
  aaffFees:    [1100, 1100, 1120, 1130, 1140],
  vecinos:     12,
  costPersonal:[0.60, 0.58, 0.55, 0.50, 0.45],
  costOtros:   [0.20, 0.18, 0.17, 0.15, 0.15],
  costPrest:   0.02,
  capex:       0.02,
  amort:       0.02,
  wc:          0.04,
  tax:         0.25,
  wacc:        0.12,
  g:           0.02,
  pctCompra:   0.75,
  multCompra:  1.30,
  multEBITDA:  7,
  commPond:    1.0,
  propPond:    1.0,
};

/* ─── MODEL ENGINE ─── */
function calcModel(p, commSvcs, propSvcs) {
  const ccppArr = [p.ccpp];
  for (let i = 0; i < 4; i++) ccppArr.push(ccppArr[i] * (1 + p.growthRates[i]));

  const aaffRev = ccppArr.map((c, i) => c * p.aaffFees[i]);

  const commRev = ccppArr.map((ccpp, yr) => {
    let t = 0;
    commSvcs.forEach(s => {
      const tam = s.penet * s.prima * s.margen * Math.pow(1 + s.deltaTAM, yr);
      t += ccpp * tam * s.conv[yr];
    });
    return t * p.commPond;
  });

  const propRev = ccppArr.map((ccpp, yr) => {
    let t = 0;
    propSvcs.forEach(s => {
      const tam = s.penet * s.prima * s.margen * p.vecinos * Math.pow(1 + s.deltaTAM, yr);
      t += ccpp * tam * s.conv[yr];
    });
    return t * p.propPond;
  });

  const totalRev = aaffRev.map((a, i) => a + commRev[i] + propRev[i]);

  const ebitda = totalRev.map((rev, i) =>
    rev * (1 - p.costPersonal[i] - p.costOtros[i] - p.costPrest)
  );

  const ebit      = ebitda.map((e, i) => e - totalRev[i] * p.amort);
  const netIncome = ebit.map(e => e * (1 - p.tax));

  const fcfe = netIncome.map((n, i) => {
    const amortAbs = totalRev[i] * p.amort;
    const capexAbs = totalRev[i] * p.capex;
    const deltaWC  = i === 0
      ? totalRev[i] * p.wc
      : (totalRev[i] - totalRev[i - 1]) * p.wc;
    return n + amortAbs - capexAbs - deltaWC;
  });

  const fcfeAdj = fcfe.map(f => f * p.pctCompra);

  const pv        = fcfeAdj.reduce((acc, f, i) => acc + f / Math.pow(1 + p.wacc, i + 1), 0);
  const tv        = fcfeAdj[4] * (1 + p.g) / (p.wacc - p.g);
  const pvTv      = tv / Math.pow(1 + p.wacc, 5);
  const ev        = pv + pvTv;

  const inversion = totalRev[0] * p.multCompra * p.pctCompra;
  const mom       = ev / inversion;

  let payback = null;
  let cum = 0;
  for (let i = 0; i < fcfeAdj.length; i++) {
    cum += fcfeAdj[i];
    if (cum >= inversion && payback === null)
      payback = i + 1 + (inversion - (cum - fcfeAdj[i])) / fcfeAdj[i];
  }

  const ebitdaMargins = ebitda.map((e, i) => e / totalRev[i]);

  return { ccppArr, aaffRev, commRev, propRev, totalRev, ebitda, ebitdaMargins, netIncome, fcfe, fcfeAdj, ev, inversion, mom, payback };
}

/* ─── REUSABLE UI ─── */
const S = {
  headerBg:    "#0a0a0a",
  teal:        "#1D9E75",
  tealLight:   "#9FE1CB",
  tealDark:    "#085041",
  blueBg:      "#E6F1FB",
  blueText:    "#0C447C",
  greenBg:     "#E1F5EE",
  greenText:   "#085041",
  border:      "1px solid #e5e5e5",
  radius:      8,
  radiusLg:    12,
};

function SliderRow({ label, value, min, max, step, onChange, format }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
      <span style={{ fontSize:12, color:"#666", width:190, flexShrink:0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex:1, accentColor: S.teal }} />
      <span style={{ fontSize:12, fontWeight:500, width:58, textAlign:"right", flexShrink:0, fontVariantNumeric:"tabular-nums" }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function YearSliders({ label, values, min, max, step, onChange, format }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <div style={{ fontSize:12, color:"#444", marginBottom:6, fontWeight:500 }}>{label}</div>}
      {values.map((v, i) => (
        <SliderRow key={i} label={`Año ${i + 1}`} value={v} min={min} max={max} step={step}
          onChange={val => { const n = [...values]; n[i] = val; onChange(n); }}
          format={format} />
      ))}
    </div>
  );
}

function KpiCard({ label, value, delta, positive }) {
  return (
    <div style={{ background:"#f7f7f5", borderRadius:S.radius, padding:"12px 14px" }}>
      <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:600, color:"#111" }}>{value}</div>
      {delta && (
        <div style={{ fontSize:11, marginTop:3, color: positive ? S.teal : "#E24B4A" }}>{delta}</div>
      )}
    </div>
  );
}

function SvcEditor({ svc, onConvChange, onPenetChange, maxConv }) {
  return (
    <div style={{ marginBottom:14, border:S.border, borderRadius:S.radiusLg, padding:"12px 14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:500 }}>{svc.name}</span>
        <span style={{ fontSize:11, color:"#888" }}>{svc.prima.toLocaleString("es-ES")}€ · {pct(svc.margen)} mg</span>
      </div>
      <SliderRow label="% Penetración" value={svc.penet} min={0} max={1} step={0.05}
        onChange={onPenetChange} format={pct} />
      <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>Conversión por año:</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {svc.conv.map((c, i) => (
          <div key={i} style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#999", marginBottom:3 }}>Año {i + 1}</div>
            <input type="range" min={0} max={maxConv || 1} step={0.005} value={c}
              onChange={e => onConvChange(i, parseFloat(e.target.value))}
              style={{ width:"100%", accentColor: S.teal }} />
            <div style={{ fontSize:11, fontWeight:500, color: S.tealDark }}>{pct(c)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTable({ res }) {
  const rows = [
    ["CCPP",            ...res.ccppArr.map(v => Math.round(v).toLocaleString("es-ES"))],
    ["Facturación",     ...res.totalRev.map(fmt)],
    ["↳ AAFF",          ...res.aaffRev.map(fmt)],
    ["↳ Community",     ...res.commRev.map(fmt)],
    ["↳ Property",      ...res.propRev.map(fmt)],
    ["EBITDA",          ...res.ebitda.map(fmt)],
    ["Margen EBITDA",   ...res.ebitdaMargins.map(pct)],
    ["Beneficio neto",  ...res.netIncome.map(fmt)],
    ["FCFe (100%)",     ...res.fcfe.map(fmt)],
    ["FCFe (×% comp.)", ...res.fcfeAdj.map(fmt)],
  ];
  const bold = [5, 8, 9];
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ borderBottom:"1px solid #e5e5e5" }}>
            {["Métrica", ...YEARS].map(h => (
              <th key={h} style={{ padding:"6px 10px", fontWeight:500, fontSize:11, color:"#888", textAlign: h==="Métrica" ? "left" : "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom:"1px solid #f0f0f0", background: ri % 2 === 0 ? "transparent" : "#fafaf8" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding:"8px 10px", textAlign: ci===0?"left":"right", color: ci===0?"#888":"#111", fontWeight: bold.includes(ri) ? 500 : 400 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── MAIN APP ─── */
const TABS = ["Resumen", "Cartera & AAFF", "Costes", "Community", "Property", "Valoración"];

export default function App() {
  const [tab,          setTab]         = useState(0);
  const [p,            setP]           = useState(DEFAULTS);
  const [commSvcs,     setCommSvcs]    = useState(COMMUNITY_SERVICES_DEF);
  const [propSvcs,     setPropSvcs]    = useState(PROPERTY_SERVICES_DEF);

  const res  = useMemo(() => calcModel(p, commSvcs, propSvcs), [p, commSvcs, propSvcs]);
  const base = useMemo(() => calcModel(DEFAULTS, COMMUNITY_SERVICES_DEF, PROPERTY_SERVICES_DEF), []);

  const set = useCallback((key, val) => setP(prev => ({ ...prev, [key]: val })), []);

  const chartRevData = YEARS.map((y, i) => ({
    name: y,
    AAFF:      Math.round(res.aaffRev[i] / 1000),
    Community: Math.round(res.commRev[i] / 1000),
    Property:  Math.round(res.propRev[i] / 1000),
  }));

  const chartMarginData = YEARS.map((y, i) => ({
    name:   y,
    EBITDA: Math.round(res.ebitda[i]    / 1000),
    FCFe:   Math.round(res.fcfe[i]      / 1000),
  }));

  const updateCommConv  = (id, yr, val) => setCommSvcs(prev => prev.map(s => s.id!==id ? s : (() => { const c=[...s.conv]; c[yr]=val; return {...s,conv:c}; })()));
  const updateCommPenet = (id, val)     => setCommSvcs(prev => prev.map(s => s.id!==id ? s : {...s, penet:val}));
  const updatePropConv  = (id, yr, val) => setPropSvcs(prev => prev.map(s => s.id!==id ? s : (() => { const c=[...s.conv]; c[yr]=val; return {...s,conv:c}; })()));
  const updatePropPenet = (id, val)     => setPropSvcs(prev => prev.map(s => s.id!==id ? s : {...s, penet:val}));

  const deltaSign = (v, b) => {
    const d = v - b;
    return { str: (d >= 0 ? "+" : "") + fmt(Math.abs(d)) + (d >= 0 ? "" : " menos") + " vs. base", pos: d >= 0 };
  };

  return (
    <div style={{ fontFamily:"'DM Sans', system-ui, sans-serif", minHeight:"100vh", background:"#fff" }}>

      {/* ── HEADER ── */}
      <div style={{ background: S.headerBg, padding:"18px 20px 14px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:14 }}>
          <span style={{ fontSize:17, fontWeight:600, color:"#fff", letterSpacing:"-0.02em" }}>INMENSIA</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.07em" }}>MODELO DE VALORACIÓN · AAFF</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
          {[
            { label:"Equity Value DCF",    value: fmtM(res.ev),      ...deltaSign(res.ev, base.ev) },
            { label:"Inversión (75%)",     value: fmt(res.inversion) },
            { label:"MoM inversión",       value: fmtX(res.mom),     ...deltaSign(res.mom * 1e6, base.mom * 1e6) },
            { label:"Payback",             value: res.payback ? res.payback.toFixed(1)+"a" : ">5a" },
            { label:"Facturación año 5",   value: fmt(res.totalRev[4]) },
          ].map((k, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.08)", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4, letterSpacing:"0.04em" }}>{k.label}</div>
              <div style={{ fontSize:15, fontWeight:600, color:"#fff" }}>{k.value}</div>
              {k.str && <div style={{ fontSize:10, marginTop:2, color: k.pos ? "#5DCAA5" : "#F09595" }}>{k.str}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid #e5e5e5", background:"#fafaf8", overflowX:"auto" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding:"10px 18px", fontSize:12,
            fontWeight: tab===i ? 500 : 400,
            color: tab===i ? "#111" : "#888",
            background:"transparent", border:"none",
            borderBottom: tab===i ? `2px solid ${S.headerBg}` : "2px solid transparent",
            cursor:"pointer", whiteSpace:"nowrap",
          }}>{t}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding:"16px 20px 40px" }}>

        {/* TAB 0 — RESUMEN */}
        {tab === 0 && (
          <>
            <div style={{ fontSize:13, fontWeight:500, color:"#111", margin:"4px 0 12px", paddingBottom:6, borderBottom:"1px solid #e5e5e5" }}>
              Ingresos por línea (K€)
            </div>
            <div style={{ height:220, marginBottom:20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRevData} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:"#999" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"#999" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}K`} />
                  <Tooltip formatter={(v, n) => [`${v}K€`, n]} contentStyle={{ fontSize:12, borderRadius:6 }} />
                  <Bar dataKey="AAFF"      stackId="a" fill={S.headerBg} />
                  <Bar dataKey="Community" stackId="a" fill={S.teal} />
                  <Bar dataKey="Property"  stackId="a" fill={S.tealLight} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", gap:16, marginBottom:20, fontSize:12, color:"#888" }}>
              {[[S.headerBg,"AAFF"],[S.teal,"Community"],[S.tealLight,"Property"]].map(([c,l]) => (
                <span key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:c, display:"inline-block" }} />{l}
                </span>
              ))}
            </div>

            <div style={{ fontSize:13, fontWeight:500, color:"#111", margin:"0 0 12px", paddingBottom:6, borderBottom:"1px solid #e5e5e5" }}>
              EBITDA y FCFe (K€)
            </div>
            <div style={{ height:190, marginBottom:24 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartMarginData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:"#999" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"#999" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}K`} />
                  <Tooltip formatter={(v, n) => [`${v}K€`, n]} contentStyle={{ fontSize:12, borderRadius:6 }} />
                  <Line dataKey="EBITDA" stroke={S.headerBg} strokeWidth={2} dot={{ r:3 }} />
                  <Line dataKey="FCFe"   stroke={S.teal}      strokeWidth={2} dot={{ r:3 }} strokeDasharray="5 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ fontSize:13, fontWeight:500, color:"#111", margin:"0 0 12px", paddingBottom:6, borderBottom:"1px solid #e5e5e5" }}>
              Tabla de métricas
            </div>
            <SummaryTable res={res} />
          </>
        )}

        {/* TAB 1 — CARTERA */}
        {tab === 1 && (
          <>
            <div style={{ fontSize:13, fontWeight:500, margin:"4px 0 14px" }}>Cartera de comunidades</div>
            <SliderRow label="Nº CCPP inicio" value={p.ccpp} min={200} max={5000} step={50} onChange={v => set("ccpp", v)} />
            <SliderRow label="Vecinos por CCPP" value={p.vecinos} min={5} max={30} step={1} onChange={v => set("vecinos", v)} />
            <div style={{ borderTop:"1px solid #e5e5e5", margin:"14px 0" }} />
            <YearSliders label="Crecimiento anual cartera (%)" values={p.growthRates} min={0} max={0.15} step={0.005}
              onChange={v => set("growthRates", v)} format={pct} />
            <div style={{ borderTop:"1px solid #e5e5e5", margin:"14px 0" }} />
            <div style={{ fontSize:12, fontWeight:500, color:"#444", marginBottom:8 }}>Facturación AAFF por CCPP (€/año)</div>
            {p.aaffFees.map((v, i) => (
              <SliderRow key={i} label={`Año ${i+1}`} value={v} min={600} max={2000} step={10}
                onChange={val => { const n=[...p.aaffFees]; n[i]=val; set("aaffFees",n); }}
                format={v => `${v}€`} />
            ))}
            <div style={{ borderTop:"1px solid #e5e5e5", margin:"14px 0" }} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
              {res.ccppArr.map((c, i) => (
                <div key={i} style={{ background:"#f7f7f5", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#999", marginBottom:4 }}>{YEARS[i]}</div>
                  <div style={{ fontSize:15, fontWeight:600 }}>{Math.round(c).toLocaleString("es-ES")}</div>
                  <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{fmt(res.aaffRev[i])}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 2 — COSTES */}
        {tab === 2 && (
          <>
            <YearSliders label="Personal (% sobre facturación)" values={p.costPersonal} min={0.30} max={0.80} step={0.01}
              onChange={v => set("costPersonal", v)} format={pct} />
            <div style={{ borderTop:"1px solid #e5e5e5", margin:"14px 0" }} />
            <YearSliders label="Otros gastos operativos (% sobre facturación)" values={p.costOtros} min={0.05} max={0.35} step={0.005}
              onChange={v => set("costOtros", v)} format={pct} />
            <div style={{ borderTop:"1px solid #e5e5e5", margin:"14px 0" }} />
            <div style={{ fontSize:12, fontWeight:500, color:"#444", marginBottom:10 }}>Parámetros fijos</div>
            <SliderRow label="Prestación de servicio"   value={p.costPrest} min={0.01} max={0.06} step={0.005} onChange={v=>set("costPrest",v)} format={pct} />
            <SliderRow label="CAPEX"                    value={p.capex}     min={0.01} max={0.05} step={0.005} onChange={v=>set("capex",v)}     format={pct} />
            <SliderRow label="Amortización"             value={p.amort}     min={0.01} max={0.05} step={0.005} onChange={v=>set("amort",v)}     format={pct} />
            <SliderRow label="Capital de trabajo"       value={p.wc}        min={0.01} max={0.08} step={0.005} onChange={v=>set("wc",v)}        format={pct} />
            <SliderRow label="Tasa impositiva"          value={p.tax}       min={0.15} max={0.30} step={0.01}  onChange={v=>set("tax",v)}       format={pct} />
            <div style={{ borderTop:"1px solid #e5e5e5", margin:"14px 0" }} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
              {res.ebitdaMargins.map((m, i) => (
                <div key={i} style={{ background:"#f7f7f5", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#999", marginBottom:4 }}>{YEARS[i]}</div>
                  <div style={{ fontSize:15, fontWeight:600, color: m>0.25?S.teal:m>0.15?"#BA7517":"#E24B4A" }}>{pct(m)}</div>
                  <div style={{ fontSize:10, color:"#888", marginTop:2 }}>EBITDA {fmt(res.ebitda[i])}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 3 — COMMUNITY */}
        {tab === 3 && (
          <>
            <SliderRow label="Ponderación global Community" value={p.commPond} min={0.5} max={1.0} step={0.05}
              onChange={v => set("commPond", v)} format={pct} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, margin:"12px 0 16px" }}>
              {res.commRev.map((v, i) => (
                <div key={i} style={{ background: S.greenBg, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color: S.teal, marginBottom:4 }}>{YEARS[i]}</div>
                  <div style={{ fontSize:15, fontWeight:600, color: S.tealDark }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            {commSvcs.map(s => (
              <SvcEditor key={s.id} svc={s} maxConv={1}
                onConvChange={(yr, val) => updateCommConv(s.id, yr, val)}
                onPenetChange={val     => updateCommPenet(s.id, val)} />
            ))}
          </>
        )}

        {/* TAB 4 — PROPERTY */}
        {tab === 4 && (
          <>
            <SliderRow label="Ponderación global Property" value={p.propPond} min={0.5} max={1.0} step={0.05}
              onChange={v => set("propPond", v)} format={pct} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, margin:"12px 0 16px" }}>
              {res.propRev.map((v, i) => (
                <div key={i} style={{ background: S.blueBg, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#378ADD", marginBottom:4 }}>{YEARS[i]}</div>
                  <div style={{ fontSize:15, fontWeight:600, color: S.blueText }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            {propSvcs.map(s => (
              <SvcEditor key={s.id} svc={s} maxConv={0.5}
                onConvChange={(yr, val) => updatePropConv(s.id, yr, val)}
                onPenetChange={val     => updatePropPenet(s.id, val)} />
            ))}
          </>
        )}

        {/* TAB 5 — VALORACIÓN */}
        {tab === 5 && (
          <>
            <div style={{ fontSize:13, fontWeight:500, margin:"4px 0 14px" }}>Parámetros de valoración</div>
            <SliderRow label="WACC / Ke"                 value={p.wacc}       min={0.08} max={0.20} step={0.005} onChange={v=>set("wacc",v)}       format={pct} />
            <SliderRow label="Crecimiento perpetuo (g)"  value={p.g}          min={0.005}max={0.04} step={0.005} onChange={v=>set("g",v)}           format={pct} />
            <SliderRow label="% Compra acordado"         value={p.pctCompra}  min={0.51} max={1.0}  step={0.01}  onChange={v=>set("pctCompra",v)}   format={pct} />
            <SliderRow label="Múltiplo compra s/ Fact."  value={p.multCompra} min={0.5}  max={2.5}  step={0.05}  onChange={v=>set("multCompra",v)}  format={v=>`${v.toFixed(2)}×`} />
            <SliderRow label="Múltiplo EBITDA referencia"value={p.multEBITDA} min={3}    max={12}   step={0.5}   onChange={v=>set("multEBITDA",v)}  format={v=>`${v}×`} />

            <div style={{ borderTop:"1px solid #e5e5e5", margin:"16px 0 14px" }} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <KpiCard label="Equity Value DCF (100%)"         value={fmtM(res.ev)} />
              <KpiCard label={`EV (${pct(p.pctCompra)} compra)`} value={fmtM(res.ev * p.pctCompra)} />
              <KpiCard label="Inversión total"                 value={fmt(res.inversion)} />
              <KpiCard label="Creación de valor neta"
                value={fmt(Math.abs(res.ev * p.pctCompra - res.inversion))}
                delta={res.ev * p.pctCompra > res.inversion ? "positiva" : "negativa"}
                positive={res.ev * p.pctCompra > res.inversion} />
              <KpiCard label="MoM sobre inversión"  value={fmtX(res.mom)}
                delta={`base: ${fmtX(base.mom)}`} positive={res.mom >= base.mom} />
              <KpiCard label="Payback estimado"     value={res.payback ? res.payback.toFixed(1)+"a" : ">5a"} />
            </div>

            <div style={{ borderTop:"1px solid #e5e5e5", margin:"16px 0 14px" }} />
            <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Comparativa de métodos</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #e5e5e5" }}>
                  {["Método","Valor 100%",`Valor ${pct(p.pctCompra)}`,`MoM vs. inv.`].map(h=>(
                    <th key={h} style={{ padding:"6px 10px", fontWeight:500, fontSize:11, color:"#888", textAlign: h==="Método"?"left":"right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["DCF (FCF proyectados)",      res.ev,                             res.ev * p.pctCompra],
                  ["Múltiplo EBITDA año 1",      res.ebitda[0] * p.multEBITDA,       res.ebitda[0] * p.multEBITDA * p.pctCompra],
                  ["Múltiplo facturación año 1", res.totalRev[0] * p.multCompra,     res.totalRev[0] * p.multCompra * p.pctCompra],
                ].map(([name, v100, vadj], ri) => (
                  <tr key={ri} style={{ borderBottom:"1px solid #f0f0f0", background: ri%2===0?"transparent":"#fafaf8" }}>
                    <td style={{ padding:"9px 10px", color:"#888" }}>{name}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontWeight:500 }}>{fmtM(v100)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right" }}>{fmtM(vadj)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontWeight:500, color: vadj>res.inversion?S.teal:"#E24B4A" }}>
                      {fmtX(vadj / res.inversion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
