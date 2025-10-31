import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from './config/api';
import './index.css';

function Stat({ label, value, hint }) {
  return (
    <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>{label}</div>
      <div style={{fontSize:28,fontWeight:800}}>{value}</div>
      {hint ? <div style={{fontSize:12,color:'var(--muted)'}}>{hint}</div> : null}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:16,fontWeight:700}}>{title}</div>
        {subtitle && <div style={{fontSize:12,color:'var(--muted)'}}>{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={{background:'transparent',color:'var(--text)',border:'1px solid var(--border)',padding:'8px 10px',borderRadius:8}}>
      {options.map(opt => <option key={opt} value={opt} style={{color:'#111'}}>{opt}</option>)}
    </select>
  );
}

function Legend({ items, colors }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      {items.map(k => (
        <div key={k} style={{display:'flex',alignItems:'center',gap:6,border:'1px solid var(--border)',padding:'6px 8px',borderRadius:8}}>
          <span style={{width:10,height:10,background:colors[k]||'#888',borderRadius:2}}/>
          <span style={{fontSize:12}}>{k}</span>
        </div>
      ))}
    </div>
  );
}

// Lightweight SVG line chart (no Chart.js) for reliability
function TinyLineChart({ seriesMap, years, colors }) {
  const width = 800, height = 240, pad = 32;
  const max = useMemo(() => Math.max(1, ...Object.values(seriesMap).flat()), [seriesMap]);
  const xs = (i) => pad + (i*(width-2*pad))/Math.max(1, years.length-1);
  const ys = (v) => height-pad - (v/max)*(height-2*pad);

  const paths = Object.entries(seriesMap).map(([name, vals]) => {
    const d = vals.map((v,i)=>`${i===0?'M':'L'} ${xs(i)} ${ys(v)}`).join(' ');
    return <path key={name} d={d} fill="none" stroke={colors[name]||'#888'} strokeWidth={2}/>;
  });

  const xTicks = years.map((y,i)=>(
    <g key={y}>
      <line x1={xs(i)} x2={xs(i)} y1={height-pad} y2={height-pad+4} stroke="#444" />
      <text x={xs(i)} y={height-pad+16} fill="#9aa4b2" fontSize="10" textAnchor="middle">{y}</text>
    </g>
  ));

  const yTicks = [...Array(5)].map((_,i)=>{
    const v = (i/4)*max; const y = ys(v);
    return (
      <g key={i}>
        <line x1={pad-4} x2={width-pad} y1={y} y2={y} stroke="#242a35" />
        <text x={pad-8} y={y+3} fill="#9aa4b2" fontSize="10" textAnchor="end">{v>=1_000_000?(v/1_000_000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v}</text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{width:'100%',height:260}}>
      <rect x={0} y={0} width={width} height={height} fill="transparent" />
      {yTicks}
      {xTicks}
      {paths}
    </svg>
  );
}

// Lightweight SVG stacked bars for monthly
function TinyBars({ dataByMonth, months, colors }) {
  const width=800, height=260, pad=32;
  const max = Math.max(1, ...months.map(m => Object.values(dataByMonth[m]||{}).reduce((a,b)=>a+b,0)));
  const bx = (i)=> pad + i*(width-2*pad)/months.length;
  const bw = (width-2*pad)/months.length - 6;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{width:'100%',height:260}}>
      <rect x={0} y={0} width={width} height={height} fill="transparent" />
      {months.map((m, i)=>{
        const stack = dataByMonth[m]||{};
        let acc = 0;
        return Object.entries(stack).map(([country,val])=>{
          const h = (val/max)*(height-2*pad);
          const y = height-pad - acc - h; acc += h;
          return <rect key={country+m} x={bx(i)} y={y} width={bw} height={h} fill={colors[country]||'#888'} />
        })
      })}
      {months.map((m,i)=>(
        <g key={m}>
          <line x1={bx(i)} x2={bx(i)} y1={height-pad} y2={height-pad+4} stroke="#444" />
          <text x={bx(i)+bw/2} y={height-pad+16} fill="#9aa4b2" fontSize="10" textAnchor="middle">{m}</text>
        </g>
      ))}
    </svg>
  );
}

export default function App() {
  const [yearly, setYearly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [impact, setImpact] = useState([]);
  const [stats, setStats] = useState(null);
  const [countries, setCountries] = useState([]);
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [selCountries, setSelCountries] = useState(['South Korea','China','Taiwan','Hong Kong','USA','Thailand']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const colors = useMemo(()=>({
    'South Korea':'#ef4444','China':'#f59e0b','Taiwan':'#eab308','Hong Kong':'#22c55e','USA':'#3b82f6','Thailand':'#a855f7'
  }),[]);

  const years = useMemo(()=>Array.from(new Set(yearly.map(r=>r.year))).sort(),[yearly]);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  async function loadAll(y){
    setLoading(true); setError('');
    try{
      const [yres,mres,ires,sres,cres] = await Promise.all([
        axios.get(API_ENDPOINTS.TOURISM_DATA_YEARLY),
        axios.get(API_ENDPOINTS.TOURISM_DATA_MONTHLY(y)),
        axios.get(API_ENDPOINTS.COVID_IMPACT),
        axios.get(API_ENDPOINTS.STATS),
        axios.get(API_ENDPOINTS.COUNTRIES)
      ]);
      setYearly(yres.data||[]);
      setMonthly(mres.data||[]);
      setImpact(ires.data||[]);
      setStats(sres.data||{});
      setCountries(cres.data||[]);
    }catch(e){
      console.error(e);
      setError('Failed to load data. The service may be warming up.');
    }finally{ setLoading(false); }
  }

  useEffect(()=>{ loadAll(selYear); },[]);
  useEffect(()=>{ loadAll(selYear); },[selYear]);

  const yearlySeries = useMemo(()=>{
    const map={};
    selCountries.forEach(c=>{ map[c]=years.map(y=>{ const row=yearly.find(r=>r.country===c && r.year===y); return row?row.visitors:0;});});
    return map;
  },[yearly,years,selCountries]);

  const monthlyStack = useMemo(()=>{
    const byMonth={};
    months.forEach((m,idx)=>{
      const list = monthly.filter(r=>r.month===idx+1 && selCountries.includes(r.country));
      byMonth[m] = list.reduce((acc,r)=>{ acc[r.country]=(acc[r.country]||0)+r.visitors; return acc;},{});
    });
    return byMonth;
  },[monthly,selCountries]);

  const impactView = useMemo(()=> impact.filter(r=>selCountries.includes(r.country)),[impact,selCountries]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-container">
          <div>
            <div className="header-title">Japan Tourism Trends Dashboard</div>
            <div className="header-subtitle">International Visitor Arrivals • COVID-19 Impact & Recovery</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="refresh-button" onClick={()=>loadAll(selYear)}>Refresh</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container" style={{display:'grid',gap:16}}>
          {/* Top stats */}
          <div className="stats-section">
            <Stat label="Total Monthly Visitors" value={(stats?.totalVisitors||0).toLocaleString()} hint="From selected month" />
            <Stat label="Monthly Growth" value={`${stats?.monthlyGrowth??0}%`} hint="vs previous month" />
            <Stat label="Top Country" value={stats?.topCountry||'—'} hint="Current month" />
          </div>

          {/* Controls */}
          <Card title="Filters">
            <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
              <div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Year (Monthly View)</div>
                <Select value={selYear} onChange={(v)=>setSelYear(Number(v))} options={[2018,2019,2020,2021,2022,2023,2024,2025]} />
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Countries</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {countries.map(c=>{
                    const on = selCountries.includes(c);
                    return (
                      <button key={c} onClick={()=> setSelCountries(on? selCountries.filter(x=>x!==c): [...selCountries,c])}
                        style={{padding:'6px 10px',borderRadius:999,border:'1px solid var(--border)',background:on?'#1e293b':'transparent',color:'var(--text)'}}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Yearly Trends */}
          <Card title="Yearly Trends (2018–2025)" subtitle="Shows COVID dip and recovery">
            {loading || years.length===0 ? (
              <div className="chart-fallback"><div className="chart-fallback-card"><div className="dot"/><h3>Loading yearly data…</h3><p>Please wait</p></div></div>
            ) : (
              <>
                <TinyLineChart seriesMap={yearlySeries} years={years} colors={colors} />
                <div style={{marginTop:8}}><Legend items={selCountries} colors={colors} /></div>
              </>
            )}
          </Card>

          {/* Monthly Stacked */}
          <Card title={`Monthly Distribution (${selYear})`} subtitle="Seasonality by selected countries">
            {loading ? (
              <div className="chart-fallback"><div className="chart-fallback-card"><div className="dot"/><h3>Loading monthly data…</h3><p>Please wait</p></div></div>
            ) : (
              <TinyBars dataByMonth={monthlyStack} months={months} colors={colors} />
            )}
          </Card>

          {/* COVID Impact */}
          <Card title="COVID-19 Impact & Recovery">
            <div style={{display:'grid',gap:8}}>
              {impactView.length===0 ? (
                <div className="chart-fallback"><div className="chart-fallback-card"><div className="dot"/><h3>No impact data yet</h3><p>Will appear after first ingestion</p></div></div>
              ) : impactView.map(row => (
                <div key={row.country} style={{display:'flex',justifyContent:'space-between',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{width:10,height:10,background:colors[row.country]||'#888'}} />
                    <strong>{row.country}</strong>
                  </div>
                  <div style={{color:'#ef4444'}}>Decline: {Math.abs(row.declinePercent||0).toFixed(1)}%</div>
                  <div style={{color:'#22c55e'}}>Recovery vs 2019: {(row.recoveryPercent||0).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-left">
            <h4>Japan Tourism Trends Dashboard</h4>
            <p>Data auto-refreshes every 10 minutes • Backend updates every 6 hours</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
