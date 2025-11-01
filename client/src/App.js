import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from './config/api';
import './index.css';

const COLORS = {
  'South Korea':'#5E9EFF','China':'#4FD1C5','Taiwan':'#E5B567','Hong Kong':'#A78BFA','USA':'#60A5FA','Thailand':'#F472B6'
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const isArray = v=>Array.isArray(v); const isObject=v=>v && typeof v==='object' && !Array.isArray(v);
const bust=u=>u+(u.includes('?')?'&':'?')+'t=' + Date.now();

function Stat({ icon, label, value, hint }){
  return(
    <div className="card">
      <div className="stat-label"><i className={`fa-solid ${icon}`} style={{marginRight:6}}/> {label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div style={{fontSize:12,color:'var(--muted)'}}>{hint}</div>}
    </div>
  );
}

function Card({ title, sub, children, icon }){
  return(
    <section className="card">
      <h3 className="card-title">{icon && <i className={`fa-solid ${icon}`} style={{marginRight:8}}/>}{title}</h3>
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </section>
  );
}

function Legend({ items }){
  return(
    <div className="legend">
      {items.map(k=> (
        <div className="leg" key={k}>
          <span className="box" style={{background:COLORS[k]||'#888'}}/>
          <span>{k}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ seriesMap, years }){
  const width=800, height=260, pad=32;
  const allVals = Object.values(seriesMap).flat();
  const max = Math.max(1, ...(allVals.length? allVals : [1]));
  const xs=i=> pad + i*(width-2*pad)/Math.max(1, years.length-1);
  const ys=v=> height-pad - (v/max)*(height-2*pad);
  const paths = Object.entries(seriesMap).map(([name, vals])=>{
    const d = vals.map((v,i)=>`${i===0?'M':'L'} ${xs(i)} ${ys(v)}`).join(' ');
    return <path key={name} d={d} fill="none" stroke={COLORS[name]||'#888'} strokeWidth={2}/>;
  });
  const xTicks = years.map((y,i)=>(<g key={y}><line x1={xs(i)} x2={xs(i)} y1={height-pad} y2={height-pad+4} stroke="#2a323d"/><text x={xs(i)} y={height-pad+16} fill="#99A2AD" fontSize="10" textAnchor="middle">{y}</text></g>));
  const yTicks = [...Array(5)].map((_,i)=>{const v=(i/4)*max; const y=ys(v); const label=v>=1_000_000?(v/1_000_000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v; return(<g key={i}><line x1={pad-4} x2={width-pad} y1={y} y2={y} stroke="#1E232B"/><text x={pad-8} y={y+3} fill="#99A2AD" fontSize="10" textAnchor="end">{label}</text></g>)});
  return(
    <svg className="svg" viewBox={`0 0 ${width} ${height}`}>{yTicks}{xTicks}{paths}</svg>
  );
}

function StackedBars({ dataByMonth }){
  const width=800, height=260, pad=32; const n=MONTHS.length;
  const totals = MONTHS.map(m=> Object.values(dataByMonth[m]||{}).reduce((a,b)=>a+b,0));
  const max = Math.max(1, ...(totals.length? totals:[1]));
  const bx=i=> pad + i*(width-2*pad)/n; const bw=(width-2*pad)/n - 6;
  return(
    <svg className="svg" viewBox={`0 0 ${width} ${height}`}>
      {MONTHS.map((m,i)=>{
        let acc=0; const stack=dataByMonth[m]||{};
        return Object.entries(stack).map(([country,val])=>{ const h=(val/max)*(height-2*pad); const y=height-pad-acc-h; acc+=h; return <rect key={country+m} x={bx(i)} y={y} width={bw} height={h} fill={COLORS[country]||'#888'} />; });
      })}
      {MONTHS.map((m,i)=>(<g key={m}><line x1={bx(i)} x2={bx(i)} y1={height-pad} y2={height-pad+4} stroke="#2a323d"/><text x={bx(i)+bw/2} y={height-pad+16} fill="#99A2AD" fontSize="10" textAnchor="middle">{m}</text></g>))}
    </svg>
  );
}

export default function App(){
  const [yearly,setYearly]=useState([]); const [monthly,setMonthly]=useState([]); const [impact,setImpact]=useState([]);
  const [stats,setStats]=useState({}); const [countries,setCountries]=useState([]);
  const [year,setYear]=useState(new Date().getFullYear());
  const [sel,setSel]=useState(['South Korea','China','Taiwan','Hong Kong','USA','Thailand']);
  const [err,setErr]=useState(''); const [loading,setLoading]=useState(true);

  async function get(url,expect='array'){
    try{ const r=await axios.get(bust(url)); const ct=r.headers['content-type']||''; if(!ct.includes('application/json')) throw new Error(ct); if(expect==='array' && !isArray(r.data)) throw new Error('Expected array'); if(expect==='object' && !isObject(r.data)) throw new Error('Expected object'); return {ok:true,data:r.data}; }catch(e){ return {ok:false,err:`${url} → ${e.message}`}; }
  }

  async function load(){
    setLoading(true); setErr('');
    const [yr,mo,im,st,co]=await Promise.all([
      get(API_ENDPOINTS.TOURISM_DATA_YEARLY,'array'),
      get(API_ENDPOINTS.TOURISM_DATA_MONTHLY(year),'array'),
      get(API_ENDPOINTS.COVID_IMPACT,'array'),
      get(API_ENDPOINTS.STATS,'object'),
      get(API_ENDPOINTS.COUNTRIES,'array')
    ]);
    if(yr.ok) setYearly(yr.data); else setYearly([]);
    if(mo.ok) setMonthly(mo.data); else setMonthly([]);
    if(im.ok) setImpact(im.data); else setImpact([]);
    if(st.ok) setStats(st.data); else setStats({});
    if(co.ok) setCountries(co.data); else setCountries([]);
    const fails=[yr,mo,im,st,co].filter(x=>!x.ok).map(x=>x.err); if(fails.length) setErr('Some data could not be loaded.\n- '+fails.join('\n- '));
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ load(); },[year]);

  const years = useMemo(()=> Array.from(new Set((yearly||[]).map(r=>r.year))).sort(),[yearly]);
  const series = useMemo(()=>{
    const m={}; (sel||[]).forEach(c=>{ m[c]=(years||[]).map(y=>{ const row=(yearly||[]).find(r=>r.country===c && r.year===y); return row?Number(row.visitors||0):0;});}); return m;
  },[yearly,years,sel]);

  const monthMap = useMemo(()=>{
    const by={}; MONTHS.forEach((m,i)=>{ const rows=(monthly||[]).filter(r=>r.month===i+1 && (sel||[]).includes(r.country)); by[m]=rows.reduce((acc,r)=>{ acc[r.country]=(acc[r.country]||0)+Number(r.visitors||0); return acc;},{});}); return by;
  },[monthly,sel]);

  const impactItems = useMemo(()=> (impact||[]).filter(r=> (sel||[]).includes(r.country)),[impact,sel]);

  return(
    <div className="app">
      <header className="header">
        <div className="h-inner">
          <div>
            <div className="h-title"><i className="fa-solid fa-chart-line"/> Japan Tourism Trends</div>
            <div className="h-sub">International Visitor Arrivals • COVID Impact & Recovery</div>
          </div>
          <div className="h-actions">
            <select className="select" value={year} onChange={e=>setYear(Number(e.target.value))} aria-label="Select year">
              {[2018,2019,2020,2021,2022,2023,2024,2025].map(y=>(<option key={y} value={y}>{y}</option>))}
            </select>
            <button className="btn" onClick={load}><i className="fa-solid fa-rotate"/> Refresh</button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {err && <div className="banner"><i className="fa-solid fa-triangle-exclamation"/> {err}</div>}

          <div className="grid-3">
            <Stat icon="fa-users" label="Total Monthly Visitors" value={(stats?.totalVisitors||0).toLocaleString()} hint="Current month"/>
            <Stat icon="fa-trophy" label="Top Country" value={stats?.topCountry||'—'} hint="Current month leader"/>
            <Stat icon="fa-clock" label="Last Updated" value={new Date(stats?.lastUpdated||Date.now()).toLocaleString()} hint="System time"/>
          </div>

          <Card title="Yearly Trends (2018–present)" sub="COVID-19 dip and strong recovery" icon="fa-chart-line">
            {loading || (years||[]).length===0 ? (<div className="banner">Loading yearly data…</div>) : (
              <>
                <LineChart seriesMap={series} years={years}/>
                <Legend items={sel}/>
              </>
            )}
          </Card>

          <Card title={`Monthly Distribution (${year})`} sub="Seasonality across selected countries" icon="fa-calendar-days">
            {loading ? (<div className="banner">Loading monthly data…</div>) : (
              <StackedBars dataByMonth={monthMap}/>
            )}
          </Card>

          <Card title="COVID-19 Impact & Recovery" sub="Decline vs 2019 and recovery status" icon="fa-shield-heart">
            <div style={{display:'grid',gap:8}}>
              {(impactItems||[]).length===0 ? (
                <div className="banner">No impact data available yet.</div>
              ) : (impactItems||[]).map(r=> (
                <div key={r.country} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="box" style={{background:COLORS[r.country]||'#888'}}/>
                    <strong>{r.country}</strong>
                  </div>
                  <div style={{display:'flex',gap:16,alignItems:'center'}}>
                    <span style={{color:'var(--danger)'}}><i className="fa-solid fa-arrow-trend-down"/> {Math.abs(r.declinePercent||0).toFixed(1)}%</span>
                    <span style={{color:'var(--ok)'}}><i className="fa-solid fa-arrow-trend-up"/> {(r.recoveryPercent||0).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Filters" sub="Select countries to include" icon="fa-sliders">
            <div className="chips">
              <button className="chip" onClick={()=>setSel(countries)}><i className="fa-solid fa-check-double"/> Select All</button>
              <button className="chip" onClick={()=>setSel([])}><i className="fa-solid fa-eraser"/> Clear</button>
              {(countries||[]).map(c=>{
                const on=(sel||[]).includes(c);
                return (
                  <button key={c} className={`chip ${on?'on':''}`} onClick={()=> setSel(on? sel.filter(x=>x!==c): [...sel,c])}>{c}</button>
                );
              })}
            </div>
          </Card>
        </div>
      </main>

      <footer className="footer">
        <div className="f-inner">
          <i className="fa-solid fa-database"/> Data: JNTO • <i className="fa-solid fa-plug"/> API: {API_ENDPOINTS.BASE || 'same-origin'} • <i className="fa-solid fa-shield-check"/> Auto-refresh backend every 6h
        </div>
      </footer>
    </div>
  );
}
