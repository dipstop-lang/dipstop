import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ============================================================
// AIRPORT DATABASE (covers major international posts + US gateways)
// ============================================================
const AIRPORTS = {
  GRU:{city:"São Paulo",country:"BR",name:"Guarulhos Intl",region:"South America"},
  GIG:{city:"Rio de Janeiro",country:"BR",name:"Galeão Intl",region:"South America"},
  BSB:{city:"Brasília",country:"BR",name:"Brasília Intl",region:"South America"},
  MIA:{city:"Miami",country:"US",name:"Miami Intl",region:"North America"},
  FLL:{city:"Fort Lauderdale",country:"US",name:"Fort Lauderdale-Hollywood Intl",region:"North America"},
  LAX:{city:"Los Angeles",country:"US",name:"Los Angeles Intl",region:"North America"},
  SFO:{city:"San Francisco",country:"US",name:"San Francisco Intl",region:"North America"},
  PHX:{city:"Phoenix",country:"US",name:"Phoenix Sky Harbor",region:"North America"},
  TUS:{city:"Tucson",country:"US",name:"Tucson Intl",region:"North America"},
  IAD:{city:"Washington DC",country:"US",name:"Dulles Intl",region:"North America"},
  DCA:{city:"Washington DC",country:"US",name:"Reagan National",region:"North America"},
  BWI:{city:"Baltimore",country:"US",name:"Baltimore/Washington Intl",region:"North America"},
  JFK:{city:"New York",country:"US",name:"John F. Kennedy Intl",region:"North America"},
  EWR:{city:"Newark",country:"US",name:"Newark Liberty Intl",region:"North America"},
  LGA:{city:"New York",country:"US",name:"LaGuardia",region:"North America"},
  ATL:{city:"Atlanta",country:"US",name:"Hartsfield-Jackson Intl",region:"North America"},
  ORD:{city:"Chicago",country:"US",name:"O'Hare Intl",region:"North America"},
  MDW:{city:"Chicago",country:"US",name:"Midway Intl",region:"North America"},
  DFW:{city:"Dallas/Fort Worth",country:"US",name:"Dallas/Fort Worth Intl",region:"North America"},
  IAH:{city:"Houston",country:"US",name:"George Bush Intercontinental",region:"North America"},
  DEN:{city:"Denver",country:"US",name:"Denver Intl",region:"North America"},
  SEA:{city:"Seattle",country:"US",name:"Seattle-Tacoma Intl",region:"North America"},
  BOS:{city:"Boston",country:"US",name:"Logan Intl",region:"North America"},
  CLT:{city:"Charlotte",country:"US",name:"Charlotte Douglas Intl",region:"North America"},
  MSP:{city:"Minneapolis",country:"US",name:"Minneapolis-St Paul Intl",region:"North America"},
  DTW:{city:"Detroit",country:"US",name:"Detroit Metro Wayne County",region:"North America"},
  PHL:{city:"Philadelphia",country:"US",name:"Philadelphia Intl",region:"North America"},
  SLC:{city:"Salt Lake City",country:"US",name:"Salt Lake City Intl",region:"North America"},
  SAN:{city:"San Diego",country:"US",name:"San Diego Intl",region:"North America"},
  ABQ:{city:"Albuquerque",country:"US",name:"Albuquerque Intl Sunport",region:"North America"},
  BNA:{city:"Nashville",country:"US",name:"Nashville Intl",region:"North America"},
  AUS:{city:"Austin",country:"US",name:"Austin-Bergstrom Intl",region:"North America"},
  RDU:{city:"Raleigh/Durham",country:"US",name:"Raleigh-Durham Intl",region:"North America"},
  PBI:{city:"West Palm Beach",country:"US",name:"Palm Beach Intl",region:"North America"},
  TPA:{city:"Tampa",country:"US",name:"Tampa Intl",region:"North America"},
  MCO:{city:"Orlando",country:"US",name:"Orlando Intl",region:"North America"},
  YYZ:{city:"Toronto",country:"CA",name:"Toronto Pearson Intl",region:"North America"},
  YUL:{city:"Montreal",country:"CA",name:"Montréal-Trudeau Intl",region:"North America"},
  YVR:{city:"Vancouver",country:"CA",name:"Vancouver Intl",region:"North America"},
  YOW:{city:"Ottawa",country:"CA",name:"Ottawa Macdonald-Cartier Intl",region:"North America"},
  YYC:{city:"Calgary",country:"CA",name:"Calgary Intl",region:"North America"},
  YEG:{city:"Edmonton",country:"CA",name:"Edmonton Intl",region:"North America"},
  YWG:{city:"Winnipeg",country:"CA",name:"Winnipeg Richardson Intl",region:"North America"},
  MEX:{city:"Mexico City",country:"MX",name:"Benito Juárez Intl",region:"North America"},
  CUN:{city:"Cancún",country:"MX",name:"Cancún Intl",region:"North America"},
  GDL:{city:"Guadalajara",country:"MX",name:"Miguel Hidalgo y Costilla Intl",region:"North America"},
  MTY:{city:"Monterrey",country:"MX",name:"Monterrey Intl",region:"North America"},
  TIJ:{city:"Tijuana",country:"MX",name:"Tijuana Intl",region:"North America"},
  HMO:{city:"Hermosillo",country:"MX",name:"Hermosillo Intl",region:"North America"},
  BOG:{city:"Bogotá",country:"CO",name:"El Dorado Intl",region:"South America"},
  LIM:{city:"Lima",country:"PE",name:"Jorge Chávez Intl",region:"South America"},
  SCL:{city:"Santiago",country:"CL",name:"Arturo Merino Benítez Intl",region:"South America"},
  EZE:{city:"Buenos Aires",country:"AR",name:"Ezeiza Intl",region:"South America"},
  PTY:{city:"Panama City",country:"PA",name:"Tocumen Intl",region:"Central America"},
  SJO:{city:"San José",country:"CR",name:"Juan Santamaría Intl",region:"Central America"},
  NAS:{city:"Nassau",country:"BS",name:"Lynden Pindling Intl",region:"Caribbean"},
  LHR:{city:"London",country:"GB",name:"Heathrow",region:"Europe"},
  CDG:{city:"Paris",country:"FR",name:"Charles de Gaulle",region:"Europe"},
  FRA:{city:"Frankfurt",country:"DE",name:"Frankfurt Intl",region:"Europe"},
  MAD:{city:"Madrid",country:"ES",name:"Adolfo Suárez Madrid-Barajas",region:"Europe"},
  FCO:{city:"Rome",country:"IT",name:"Leonardo da Vinci-Fiumicino",region:"Europe"},
  AMS:{city:"Amsterdam",country:"NL",name:"Schiphol",region:"Europe"},
  IST:{city:"Istanbul",country:"TR",name:"Istanbul Airport",region:"Europe"},
  DOH:{city:"Doha",country:"QA",name:"Hamad Intl",region:"Middle East"},
  DXB:{city:"Dubai",country:"AE",name:"Dubai Intl",region:"Middle East"},
  NRT:{city:"Tokyo",country:"JP",name:"Narita Intl",region:"Asia"},
  ICN:{city:"Seoul",country:"KR",name:"Incheon Intl",region:"Asia"},
};

const US_CARRIERS = ["AA","DL","UA","WN","B6","AS","NK","F9","HA","SY"];
const isUS = (c) => AIRPORTS[c]?.country === "US";

const AIRLINES = {
  AA:{name:"American Airlines",flag:"US",alliance:"oneworld"},
  DL:{name:"Delta Air Lines",flag:"US",alliance:"SkyTeam"},
  UA:{name:"United Airlines",flag:"US",alliance:"Star Alliance"},
  WN:{name:"Southwest Airlines",flag:"US",alliance:"—"},
  B6:{name:"JetBlue Airways",flag:"US",alliance:"—"},
  AS:{name:"Alaska Airlines",flag:"US",alliance:"oneworld"},
  LA:{name:"LATAM Airlines",flag:"CL",alliance:"—",codeshare:["AA"]},
  AV:{name:"Avianca",flag:"CO",alliance:"Star Alliance",codeshare:["UA"]},
  CM:{name:"Copa Airlines",flag:"PA",alliance:"Star Alliance",codeshare:["UA"]},
  G3:{name:"GOL",flag:"BR",alliance:"—",codeshare:["AA"]},
  AC:{name:"Air Canada",flag:"CA",alliance:"Star Alliance",codeshare:["UA"]},
  AM:{name:"Aeroméxico",flag:"MX",alliance:"SkyTeam",codeshare:["DL"]},
  Y4:{name:"Volaris",flag:"MX",alliance:"—",codeshare:[]},
};

const CABINS = [
  {code:"Y",label:"Economy",short:"Econ",color:"#64748b"},
  {code:"W",label:"Premium Economy",short:"Prem",color:"#0ea5e9"},
  {code:"C",label:"Business",short:"Biz",color:"#d97706"},
  {code:"F",label:"First",short:"First",color:"#a855f7"},
];

const cabinMult = {Y:1, W:1.55, C:3.1, F:5.2};

// ============================================================
// AIRPORT AUTOCOMPLETE COMPONENT
// ============================================================
function AirportInput({ value, onChange, placeholder = "City or airport code…", label }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const displayValue = value ? `${value} — ${AIRPORTS[value]?.city || ""}` : "";

  useEffect(() => {
    if (!query || query.length < 1) { setResults([]); return; }
    const q = query.toLowerCase();
    const matches = Object.entries(AIRPORTS)
      .filter(([code, a]) =>
        code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
      )
      .slice(0, 12)
      .map(([code, a]) => ({ code, ...a }));
    setResults(matches);
  }, [query]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        ref={inputRef}
        className="ipt"
        value={open ? query : displayValue}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          if (e.key === "Enter" && results.length > 0) {
            onChange(results[0].code); setOpen(false); setQuery("");
          }
        }}
        style={{ width: "100%" }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 6, marginTop: 2, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}>
          {results.map((r) => (
            <div
              key={r.code}
              onClick={() => { onChange(r.code); setOpen(false); setQuery(""); }}
              style={{
                padding: "8px 12px", cursor: "pointer", display: "flex",
                justifyContent: "space-between", alignItems: "center",
                borderBottom: "1px solid rgba(148,163,184,0.06)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <span style={{ fontWeight: 700, color: "#f59e0b", fontSize: 13, marginRight: 8 }}>{r.code}</span>
                <span style={{ color: "#cbd5e1", fontSize: 12 }}>{r.city}</span>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", textAlign: "right" }}>
                <div>{r.name}</div>
                <div>{r.country}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 6, marginTop: 2, padding: "12px 16px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            No airports found. Try a different city or code.
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: 10, color: "#8b949e", letterSpacing: "0.07em",
  textTransform: "uppercase", display: "block", marginBottom: 4,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
};

// ============================================================
// FLY AMERICA COMPLIANCE
// ============================================================
function checkCompliance(segments) {
  const issues = [], warnings = [];
  let compliant = true;

  const firstUSArr = segments.find(s => isUS(s.arr));
  const lastUSDep = [...segments].reverse().find(s => isUS(s.dep));

  const checkSeg = (seg, desc) => {
    const ok = US_CARRIERS.includes(seg.mktCx) ||
      (seg.codeCx && US_CARRIERS.includes(seg.codeCx));
    if (!ok) {
      compliant = false;
      issues.push(`${desc}: ${seg.dep}→${seg.arr} on ${seg.mktCx} (${AIRLINES[seg.mktCx]?.name || seg.mktCx}) — needs US flag carrier or US codeshare`);
    }
  };

  if (firstUSArr) checkSeg(firstUSArr, "First US-arriving segment");
  if (lastUSDep) checkSeg(lastUSDep, "Last US-departing segment");

  segments.forEach((seg, i) => {
    if ((isUS(seg.dep) || isUS(seg.arr)) && !US_CARRIERS.includes(seg.mktCx) && !(seg.codeCx && US_CARRIERS.includes(seg.codeCx))) {
      if (seg !== firstUSArr && seg !== lastUSDep) {
        warnings.push(`Seg ${i+1} (${seg.dep}→${seg.arr}) on foreign carrier ${seg.mktCx} touches US soil`);
      }
    }
  });

  return { compliant, issues, warnings };
}

// ============================================================
// MOCK FLIGHT GENERATOR (per-leg)
// ============================================================
const BASE_PRICES = {
  "GRU-MIA":480,"GRU-LAX":590,"GRU-JFK":520,"GRU-IAD":510,"GRU-ATL":490,
  "GRU-DFW":530,"GRU-ORD":560,"GRU-EWR":515,"GRU-PTY":320,"GRU-BOG":310,
  "GRU-LIM":290,"GRU-SCL":210,"GRU-MEX":480,"GRU-YYZ":550,"GRU-YUL":560,
  "GRU-GIG":110,"GRU-BSB":130,
  "MIA-LAX":180,"MIA-PHX":170,"MIA-IAD":130,"MIA-JFK":120,"MIA-ATL":90,
  "MIA-DFW":140,"MIA-ORD":150,"MIA-DCA":125,"MIA-FLL":45,"MIA-TPA":70,
  "MIA-MCO":80,"MIA-BOS":160,"MIA-CLT":100,"MIA-DEN":190,
  "LAX-PHX":80,"LAX-IAD":200,"LAX-JFK":210,"LAX-SFO":70,"LAX-SEA":100,
  "LAX-DEN":90,"LAX-TIJ":60,"LAX-SAN":55,"LAX-MIA":180,"LAX-ATL":190,
  "LAX-ORD":170,"LAX-DFW":150,"LAX-SLC":110,
  "PHX-MIA":170,"PHX-IAD":190,"PHX-LAX":80,"PHX-DFW":110,"PHX-DEN":80,
  "PHX-SLC":70,"PHX-TUS":50,"PHX-ABQ":70,"PHX-SAN":75,"PHX-ORD":170,
  "IAD-MIA":130,"IAD-LAX":200,"IAD-PHX":190,"IAD-ATL":100,"IAD-ORD":120,
  "IAD-JFK":90,"IAD-DFW":160,"IAD-BOS":80,"IAD-CLT":70,
  "JFK-MIA":120,"JFK-LAX":210,"JFK-SFO":220,"JFK-ATL":110,
  "YYZ-IAD":160,"YYZ-JFK":120,"YYZ-MIA":180,"YYZ-ORD":100,
  "YUL-IAD":170,"YUL-JFK":130,"YUL-MIA":200,
  "MEX-MIA":200,"MEX-LAX":180,"MEX-IAD":250,"MEX-JFK":240,
  "CUN-MIA":140,"CUN-IAD":190,"CUN-JFK":180,
  "PTY-MIA":200,"PTY-IAD":250,"PTY-LAX":350,
  "BOG-MIA":220,"BOG-JFK":270,"BOG-IAD":260,
  "ATL-DFW":120,"ATL-ORD":110,"ATL-MIA":90,"ATL-DEN":160,
};

const getBase = (a, b) => BASE_PRICES[`${a}-${b}`] || BASE_PRICES[`${b}-${a}`] || (250 + Math.floor(Math.random()*200));

const DURATIONS = {
  "GRU-MIA":8,"GRU-LAX":12,"GRU-JFK":10,"GRU-IAD":9,"GRU-ATL":9,"GRU-DFW":10,
  "GRU-ORD":10,"GRU-PTY":6,"GRU-BOG":6,"GRU-LIM":5,"GRU-SCL":4,"GRU-MEX":10,
  "GRU-YYZ":10,"GRU-YUL":10,"MIA-LAX":5,"MIA-PHX":5,"MIA-IAD":3,"MIA-JFK":3,
  "MIA-ATL":2,"MIA-DFW":3,"MIA-ORD":3,"LAX-PHX":1,"LAX-IAD":5,"LAX-JFK":5,
  "PHX-MIA":5,"PHX-IAD":4,"PHX-DFW":2,"PTY-MIA":3,"BOG-MIA":4,"BOG-JFK":5,
  "YYZ-IAD":2,"YYZ-JFK":2,"YYZ-MIA":3,"YUL-IAD":2,"YUL-JFK":2,
  "MEX-MIA":3,"MEX-LAX":4,"CUN-MIA":2,
};
const getDur = (a, b) => DURATIONS[`${a}-${b}`] || DURATIONS[`${b}-${a}`] || (2 + Math.floor(Math.random()*5));

function generateLegFlights(dep, arr, dateStr, flexDays, cabin, includeGateways, creativeBusinessClass) {
  const results = [];
  const base = new Date(dateStr);

  // Build route options: direct + via hubs
  const routes = [[dep, arr]];
  const hubs = ["ATL","MIA","DFW","ORD","JFK","PTY","BOG","IAH","CLT"];
  hubs.forEach(h => {
    if (h !== dep && h !== arr) routes.push([dep, h, arr]);
  });
  if (includeGateways) {
    ["YYZ","YUL","YVR","MEX","CUN","GDL"].forEach(gw => {
      if (gw !== dep && gw !== arr) routes.push([dep, gw, arr]);
    });
  }

  for (let dOff = -flexDays; dOff <= flexDays; dOff++) {
    const d = new Date(base); d.setDate(d.getDate() + dOff);
    const ds = d.toISOString().split("T")[0];

    routes.forEach(route => {
      const isGatewayRoute = route.length > 2 && !isUS(route[1]) && (AIRPORTS[route[1]]?.country === "CA" || AIRPORTS[route[1]]?.country === "MX");
      const carrierSets = buildCarriers(route);
      carrierSets.forEach(cxSet => {
        const segs = [];
        let total = 0, hr = 6 + Math.floor(Math.random()*12), curDate = ds;
        const isLastSeg = (i) => i === route.length - 2;

        for (let i = 0; i < route.length - 1; i++) {
          const from = route[i], to = route[i+1];
          const cx = cxSet[i];

          // Creative Business Class: gateway routes get biz on all legs except
          // the final US-carrier compliant leg, which is economy
          let segCabin = cabin;
          if (creativeBusinessClass && isGatewayRoute) {
            segCabin = isLastSeg(i) ? "Y" : "C";
          }

          const p = Math.round(getBase(from, to) * cabinMult[segCabin] * (0.8 + Math.random()*0.45));
          total += p;
          const dur = getDur(from, to);
          const arrHr = hr + dur;
          const codeCx = (!US_CARRIERS.includes(cx) && AIRLINES[cx]?.codeshare?.length)
            ? AIRLINES[cx].codeshare[0] : null;

          segs.push({
            dep: from, arr: to, mktCx: cx, codeCx,
            airline: AIRLINES[cx]?.name || cx,
            flt: `${cx}${100+Math.floor(Math.random()*900)}`,
            depTime: `${String(hr%24).padStart(2,"0")}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}`,
            arrTime: `${String(arrHr%24).padStart(2,"0")}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}`,
            dur: `${dur}h ${Math.floor(Math.random()*50)}m`,
            date: curDate, cabin: segCabin, price: p,
            aircraft: ["B737","B777","B787","A320","A330","A350","E190"][Math.floor(Math.random()*7)],
          });
          hr = (arrHr + 1 + Math.floor(Math.random()*3)) % 24;
          if (arrHr >= 22) { const nd = new Date(curDate); nd.setDate(nd.getDate()+1); curDate = nd.toISOString().split("T")[0]; }
        }

        const compliance = checkCompliance(segs);
        const totalMin = segs.reduce((a,s) => a + parseInt(s.dur)*60 + parseInt(s.dur.split("h ")[1]||0), 0);

        results.push({
          id: `${ds}-${route.join("")}-${cxSet.join("")}-${Math.random().toString(36).substr(2,5)}`,
          segments: segs, totalPrice: total, date: ds, cabin,
          stops: route.length - 2,
          routeDesc: route.join(" → "),
          isGateway: isGatewayRoute, gatewayCode: isGatewayRoute ? route[1] : null,
          isMixedCabin: creativeBusinessClass && isGatewayRoute,
          compliance, totalMin,
        });
      });
    });
  }

  results.sort((a,b) => a.totalPrice - b.totalPrice);
  return results;
}

function buildCarriers(route) {
  const n = route.length - 1;
  const combos = [];
  // All same US
  ["AA","DL","UA"].forEach(c => combos.push(Array(n).fill(c)));
  // Mixed
  for (let i = 0; i < 5; i++) {
    const c = [];
    for (let j = 0; j < n; j++) {
      const pool = (route[j]==="GRU"||route[j+1]==="GRU")
        ? ["AA","DL","UA","LA","AV","G3","CM"]
        : (isUS(route[j]) && isUS(route[j+1]))
          ? ["AA","DL","UA","WN","B6"]
          : ["AA","DL","UA","LA","AV","CM","AC","AM"];
      c.push(pool[Math.floor(Math.random()*pool.length)]);
    }
    combos.push(c);
  }
  // Foreign with US final (for gateways)
  if (n >= 2 && !isUS(route[1])) {
    ["LA","AV","AC","AM"].forEach(fc => {
      const c = Array(n).fill(fc);
      c[n-1] = ["AA","DL","UA"][Math.floor(Math.random()*3)];
      combos.push(c);
    });
  }
  return combos;
}



// ============================================================
// MAIN APPLICATION
// ============================================================
export default function DipstopCostConstructor() {
  // -- Legs --
  const [legs, setLegs] = useState([
    { dep: "GRU", arr: "LAX", date: "2026-04-15", flex: 3 },
    { dep: "LAX", arr: "PHX", date: "2026-04-22", flex: 2 },
    { dep: "PHX", arr: "MIA", date: "2026-04-28", flex: 3 },
  ]);

  // -- Options --
  const [cabin, setCabin] = useState("Y");
  const [includeGateways, setIncludeGateways] = useState(false);
  const [complianceOnly, setComplianceOnly] = useState(true);

  // -- Authorized fare (optional cost-construction) --
  const [showCostConstruct, setShowCostConstruct] = useState(true);
  const [authFareAmount, setAuthFareAmount] = useState("");

  // -- Search state --
  const [currentLeg, setCurrentLeg] = useState(-1); // -1 = not started
  const [legResults, setLegResults] = useState({}); // legIdx -> results[]
  const [legSelections, setLegSelections] = useState({}); // legIdx -> selected flight
  const [searching, setSearching] = useState(false);

  // -- Filters --
  const [sortBy, setSortBy] = useState("price");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  // -- Config --
  const [showConfig, setShowConfig] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [useMock, setUseMock] = useState(true);

  // -- Tab --
  const [tab, setTab] = useState("build"); // "build" | "legs" | "summary" | "rules"

  // Derived
  const authFare = authFareAmount ? parseFloat(authFareAmount) || 0 : 0;
  const totalSelected = useMemo(() =>
    Object.values(legSelections).reduce((a, s) => a + s.totalPrice, 0)
  , [legSelections]);
  const allLegsSelected = Object.keys(legSelections).length === legs.length && legs.length > 0;

  // -- Leg management --
  const updateLeg = (idx, field, val) => {
    const next = [...legs];
    next[idx] = { ...next[idx], [field]: val };
    setLegs(next);
  };
  const addLeg = () => {
    const lastArr = legs.length > 0 ? legs[legs.length-1].arr : "GRU";
    const lastDate = legs.length > 0 ? legs[legs.length-1].date : "2026-04-15";
    const d = new Date(lastDate); d.setDate(d.getDate() + 7);
    setLegs([...legs, { dep: lastArr, arr: "", date: d.toISOString().split("T")[0], flex: 3 }]);
  };
  const removeLeg = (idx) => {
    if (legs.length <= 1) return;
    setLegs(legs.filter((_,i) => i !== idx));
    const ns = {...legSelections}; delete ns[idx];
    const nr = {...legResults}; delete nr[idx];
    setLegSelections(ns); setLegResults(nr);
  };

  // -- Search --
  const startSearch = () => {
    setLegSelections({});
    setLegResults({});
    setCurrentLeg(0);
    setTab("legs");
    searchLeg(0);
  };

  const searchLeg = (idx) => {
    const leg = legs[idx];
    if (!leg || !leg.dep || !leg.arr) return;
    setSearching(true);
    setTimeout(() => {
      const cab = cabin;
      const flights = generateLegFlights(leg.dep, leg.arr, leg.date, leg.flex, cab, includeGateways, includeGateways);
      setLegResults(prev => ({ ...prev, [idx]: flights }));
      setSearching(false);
    }, 800);
  };

  const selectFlight = (legIdx, flight) => {
    setLegSelections(prev => ({ ...prev, [legIdx]: flight }));
    const nextLeg = legIdx + 1;
    if (nextLeg < legs.length) {
      setCurrentLeg(nextLeg);
      searchLeg(nextLeg);
    } else {
      setCurrentLeg(legs.length); // all done
      setTab("summary");
    }
  };

  const reopenLeg = (idx) => {
    // Remove this and all subsequent selections
    const ns = { ...legSelections };
    for (let i = idx; i < legs.length; i++) delete ns[i];
    setLegSelections(ns);
    setCurrentLeg(idx);
    if (!legResults[idx]) searchLeg(idx);
  };

  // -- Filter results for current leg --
  const currentResults = useMemo(() => {
    const raw = legResults[currentLeg] || [];
    let filtered = complianceOnly ? raw.filter(r => r.compliance.compliant) : raw;
    if (carrierFilter === "us") filtered = filtered.filter(r => r.segments.every(s => US_CARRIERS.includes(s.mktCx)));
    if (carrierFilter === "mixed") filtered = filtered.filter(r => r.segments.some(s => !US_CARRIERS.includes(s.mktCx)));
    if (classFilter === "mixed") filtered = filtered.filter(r => r.isMixedCabin);
    if (classFilter === "C") filtered = filtered.filter(r => r.segments.every(s => s.cabin === "C"));
    if (classFilter === "Y") filtered = filtered.filter(r => r.segments.every(s => s.cabin === "Y"));
    filtered.sort((a,b) => {
      if (sortBy === "price") return a.totalPrice - b.totalPrice;
      if (sortBy === "duration") return a.totalMin - b.totalMin;
      if (sortBy === "stops") return a.stops - b.stops;
      return 0;
    });
    return filtered;
  }, [legResults, currentLeg, complianceOnly, carrierFilter, classFilter, sortBy]);

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg, #04080f 0%, #0b1120 35%, #0d1526 100%)",
      color:"#c9d1d9",
      fontFamily:"'DM Mono', 'IBM Plex Mono', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .hd{font-family:'Playfair Display',serif}
        .ui{font-family:'DM Sans',sans-serif}
        .mn{font-family:'DM Mono',monospace}

        .ipt{
          background:rgba(22,27,45,0.9);border:1px solid rgba(148,163,184,0.12);
          border-radius:5px;color:#e2e8f0;padding:9px 12px;font-size:13px;
          outline:none;transition:border-color 0.2s;font-family:'DM Mono',monospace;
        }
        .ipt:focus{border-color:#c2850c;box-shadow:0 0 0 2px rgba(194,133,12,0.12)}
        .ipt::placeholder{color:#3d4663}
        select.ipt{appearance:none;-webkit-appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}

        .btn{
          background:linear-gradient(135deg,#c2850c,#a06b04);color:#04080f;
          border:none;border-radius:5px;padding:10px 20px;font-weight:600;
          font-size:13px;cursor:pointer;transition:all 0.2s;letter-spacing:0.02em;
          font-family:'DM Sans',sans-serif;
        }
        .btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(194,133,12,0.25)}
        .btn:disabled{opacity:0.4;cursor:not-allowed;transform:none}

        .btn2{
          background:rgba(148,163,184,0.07);color:#8b949e;
          border:1px solid rgba(148,163,184,0.14);border-radius:5px;
          padding:8px 14px;font-size:12px;cursor:pointer;transition:all 0.2s;
          font-family:'DM Sans',sans-serif;
        }
        .btn2:hover{background:rgba(148,163,184,0.15);color:#c9d1d9}

        .glass{
          background:rgba(11,17,32,0.7);backdrop-filter:blur(10px);
          border:1px solid rgba(148,163,184,0.08);border-radius:8px;
        }

        .tab{
          background:transparent;border:none;color:#4d5669;padding:11px 18px;
          font-size:11px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;
          transition:all 0.2s;letter-spacing:0.06em;text-transform:uppercase;
          font-family:'DM Sans',sans-serif;
        }
        .tab.on{color:#c2850c;border-bottom-color:#c2850c}
        .tab:hover{color:#c9d1d9}

        .card{
          background:rgba(11,17,32,0.5);border:1px solid rgba(148,163,184,0.06);
          border-radius:8px;padding:14px;cursor:pointer;transition:all 0.2s;
        }
        .card:hover{border-color:rgba(194,133,12,0.25);transform:translateY(-1px)}
        .card.sel{border-color:#c2850c;background:rgba(194,133,12,0.04)}

        .scroll{max-height:55vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(148,163,184,0.15) transparent}
        .scroll::-webkit-scrollbar{width:5px}
        .scroll::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:3px}

        .fi{animation:fi 0.3s ease-out}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pu 1.8s ease-in-out infinite}
        @keyframes pu{0%,100%{opacity:0.4}50%{opacity:1}}

        .tgl{position:relative;width:36px;height:20px;background:rgba(100,116,139,0.25);
          border-radius:10px;cursor:pointer;transition:background 0.2s;border:none;outline:none}
        .tgl.on{background:rgba(194,133,12,0.45)}
        .tgl::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;
          background:#c9d1d9;border-radius:50%;transition:transform 0.2s}
        .tgl.on::after{transform:translateX(16px);background:#c2850c}

        .badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:3px;
          font-size:10px;font-weight:600;letter-spacing:0.03em;text-transform:uppercase;
          font-family:'DM Sans',sans-serif}
        .bg-ok{background:rgba(34,197,94,0.12);color:#4ade80}
        .bg-no{background:rgba(239,68,68,0.12);color:#f87171}
        .bg-gw{background:rgba(168,85,247,0.12);color:#c084fc}
        .bg-info{background:rgba(14,165,233,0.12);color:#38bdf8}
        .bg-warn{background:rgba(245,158,11,0.12);color:#fbbf24}
        .bg-dim{background:rgba(100,116,139,0.12);color:#8b949e}

        .leg-header{
          display:flex;align-items:center;gap:12px;padding:12px 16px;
          border-radius:6px;cursor:pointer;transition:background 0.15s;
        }
        .leg-header:hover{background:rgba(148,163,184,0.04)}
        .leg-header.active{background:rgba(194,133,12,0.05);border-left:3px solid #c2850c}
        .leg-header.done{opacity:0.8}
      `}</style>

      {/* ===== HEADER ===== */}
      <div style={{
        padding:"16px 24px",borderBottom:"1px solid rgba(148,163,184,0.06)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"rgba(4,8,15,0.85)",backdropFilter:"blur(10px)",
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{
            width:32,height:32,background:"linear-gradient(135deg,#c2850c,#8b5e04)",
            borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:15,color:"#04080f",fontWeight:700,
          }}>✈</div>
          <div>
            <div className="hd" style={{fontSize:20,color:"#f0f3f6",letterSpacing:"-0.01em"}}>Dipstop Cost Constructor</div>
            <div className="ui" style={{fontSize:9,color:"#4d5669",letterSpacing:"0.08em",textTransform:"uppercase"}}>
              Fly America Compliant Search
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button className="btn2" onClick={() => setShowConfig(!showConfig)} style={{fontSize:10}}>
            {showConfig ? "✕" : "⚙"} API
          </button>
          <div style={{
            display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:4,
            background:useMock?"rgba(194,133,12,0.08)":"rgba(34,197,94,0.08)",
            border:`1px solid ${useMock?"rgba(194,133,12,0.2)":"rgba(34,197,94,0.2)"}`,
          }}>
            <span style={{width:6,height:6,borderRadius:"50%",background:useMock?"#c2850c":"#4ade80"}} />
            <span className="ui" style={{fontSize:9,color:useMock?"#c2850c":"#4ade80",fontWeight:600,letterSpacing:"0.05em"}}>
              {useMock?"MOCK":"LIVE"}
            </span>
          </div>
        </div>
      </div>

      {/* API Config */}
      {showConfig && (
        <div className="glass fi" style={{margin:"10px 24px",padding:16}}>
          <div className="ui" style={{fontSize:13,fontWeight:600,color:"#e2e8f0",marginBottom:10}}>Search API</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
            <div>
              <label style={labelStyle}>BACKEND URL</label>
              <input className="ipt" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="https://api.dipstopmarket.com" style={{width:"100%"}} />
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,color:"#8b949e"}}>Mock</span>
              <button className={`tgl ${useMock?"on":""}`} onClick={()=>setUseMock(!useMock)} />
            </div>
          </div>
          <p style={{marginTop:8,fontSize:10,color:"#4d5669"}}>
            Live mode connects to the Dipstop Cost Constructor backend (SerpApi + Shopify membership). Mock mode uses generated sample data.
          </p>
        </div>
      )}

      {/* TABS */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(148,163,184,0.06)",padding:"0 24px",background:"rgba(4,8,15,0.4)"}}>
        <button className={`tab ${tab==="build"?"on":""}`} onClick={()=>setTab("build")}>Build Trip</button>
        <button className={`tab ${tab==="legs"?"on":""}`} onClick={()=>setTab("legs")}>
          Select Flights {Object.keys(legSelections).length > 0 && `(${Object.keys(legSelections).length}/${legs.length})`}
        </button>
        <button className={`tab ${tab==="summary"?"on":""}`} onClick={()=>setTab("summary")}>Summary</button>
        <button className={`tab ${tab==="rules"?"on":""}`} onClick={()=>setTab("rules")}>Fly America Rules</button>
      </div>

      <div style={{padding:"18px 24px"}}>

        {/* ===== BUILD TRIP ===== */}
        {tab === "build" && (
          <div className="fi">
            {/* Cabin + Options Row */}
            <div className="glass" style={{padding:16,marginBottom:16}}>
              <div style={{display:"flex",gap:20,alignItems:"end",flexWrap:"wrap"}}>
                <div style={{minWidth:140}}>
                    <label style={labelStyle}>Search Cabin</label>
                    <select className="ipt" value={cabin} onChange={e=>setCabin(e.target.value)} style={{width:"100%"}}>
                      {CABINS.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button className={`tgl ${includeGateways?"on":""}`} onClick={()=>setIncludeGateways(!includeGateways)} />
                  <span className="ui" style={{fontSize:11,color:"#8b949e"}}>Creative Business Class Options</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button className={`tgl ${complianceOnly?"on":""}`} onClick={()=>setComplianceOnly(!complianceOnly)} />
                  <span className="ui" style={{fontSize:11,color:"#8b949e"}}>Compliant only</span>
                </div>
              </div>
            </div>

            {/* Cost Construction (optional) */}
            <div className="glass" style={{padding:16,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showCostConstruct?12:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button className={`tgl ${showCostConstruct?"on":""}`} onClick={()=>setShowCostConstruct(!showCostConstruct)} />
                  <span className="ui" style={{fontSize:12,fontWeight:600,color:"#c9d1d9"}}>Cost Construction Comparison</span>
                </div>
              </div>
              {showCostConstruct && (
                <div>
                  <div style={{fontSize:10,color:"#4d5669",marginBottom:8,lineHeight:1.5}}>
                    Enter the authorized fare from your travel orders. The summary will show how your selected itinerary compares and what you'd pay out-of-pocket.
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <label style={{...labelStyle, marginBottom:0, whiteSpace:"nowrap"}}>Authorized Fare (USD)</label>
                    <div style={{position:"relative",maxWidth:180}}>
                      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",
                        color:"#c2850c",fontWeight:700,fontSize:14,pointerEvents:"none"}}>$</span>
                      <input
                        className="ipt"
                        type="number"
                        min="0"
                        step="1"
                        value={authFareAmount}
                        onChange={e => setAuthFareAmount(e.target.value)}
                        placeholder="0"
                        style={{width:"100%",paddingLeft:24,fontSize:15,fontWeight:600,color:"#c2850c"}}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Legs Builder */}
            <div className="glass" style={{padding:16,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span className="ui" style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>Trip Legs</span>
                <button className="btn2" onClick={addLeg}>+ Add Leg</button>
              </div>

              {legs.map((leg, idx) => (
                <div key={idx} style={{
                  display:"grid",gridTemplateColumns:"1fr 1fr 140px 80px 28px",
                  gap:10,alignItems:"end",marginBottom:10,
                  padding:12,background:"rgba(22,27,45,0.4)",borderRadius:6,
                  borderLeft:`3px solid ${["#c2850c","#0ea5e9","#a855f7","#4ade80","#f87171"][idx%5]}`,
                }}>
                  <div>
                    <label style={labelStyle}>Leg {idx+1} From</label>
                    <AirportInput value={leg.dep} onChange={v => updateLeg(idx,"dep",v)} placeholder="From…" />
                  </div>
                  <div>
                    <label style={labelStyle}>To</label>
                    <AirportInput value={leg.arr} onChange={v => updateLeg(idx,"arr",v)} placeholder="To…" />
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input className="ipt" type="date" value={leg.date}
                      onChange={e => updateLeg(idx,"date",e.target.value)} style={{width:"100%"}} />
                  </div>
                  <div>
                    <label style={labelStyle}>Flex ±</label>
                    <input className="ipt" type="number" min="0" max="14" value={leg.flex}
                      onChange={e => updateLeg(idx,"flex",parseInt(e.target.value)||0)} style={{width:"100%"}} />
                  </div>
                  <button onClick={()=>removeLeg(idx)}
                    style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:16,
                      padding:4,opacity:legs.length<=1?0.2:0.7,pointerEvents:legs.length<=1?"none":"auto"}}
                    title="Remove leg">×</button>
                </div>
              ))}

              {/* Route summary */}
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {legs.map((leg,idx) => (
                  <span key={idx} style={{display:"flex",alignItems:"center",gap:4}}>
                    {idx===0 && <span style={{fontWeight:700,color:"#c2850c",fontSize:13}}>{leg.dep}</span>}
                    <span style={{color:"#3d4663"}}>→</span>
                    <span style={{fontWeight:700,color:"#c2850c",fontSize:13}}>{leg.arr}</span>
                    <span style={{fontSize:9,color:"#4d5669",marginLeft:2}}>{leg.date}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Search Button */}
            <button className="btn" onClick={startSearch}
              disabled={legs.some(l => !l.dep || !l.arr || !l.date)}
              style={{width:"100%",padding:14,fontSize:14,letterSpacing:"0.04em"}}>
              Search {legs.length} Leg{legs.length!==1?"s":""} — Fly America Compliant
            </button>

          </div>
        )}

        {/* ===== LEG-BY-LEG SELECTION ===== */}
        {tab === "legs" && (
          <div className="fi">
            {/* Leg accordion */}
            {legs.map((leg, idx) => {
              const isActive = idx === currentLeg;
              const isDone = legSelections[idx] != null;
              const isFuture = idx > currentLeg;
              const selected = legSelections[idx];

              return (
                <div key={idx} style={{marginBottom:12}}>
                  {/* Leg header */}
                  <div
                    className={`leg-header ${isActive?"active":""} ${isDone?"done":""}`}
                    onClick={() => isDone ? reopenLeg(idx) : null}
                    style={{
                      background: isDone ? "rgba(34,197,94,0.04)" : isActive ? "rgba(194,133,12,0.05)" : "rgba(11,17,32,0.3)",
                      border: `1px solid ${isDone ? "rgba(34,197,94,0.15)" : isActive ? "rgba(194,133,12,0.2)" : "rgba(148,163,184,0.06)"}`,
                      borderRadius: 6,
                      borderLeft: `3px solid ${isDone ? "#4ade80" : isActive ? "#c2850c" : "#2d3548"}`,
                    }}
                  >
                    <div style={{
                      width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:700,
                      background: isDone?"rgba(34,197,94,0.15)":isActive?"rgba(194,133,12,0.15)":"rgba(148,163,184,0.08)",
                      color: isDone?"#4ade80":isActive?"#c2850c":"#4d5669",
                    }}>
                      {isDone ? "✓" : idx+1}
                    </div>
                    <div style={{flex:1}}>
                      <div className="ui" style={{fontSize:12,fontWeight:600,color:isDone?"#4ade80":isActive?"#c2850c":"#8b949e"}}>
                        Leg {idx+1}: {leg.dep} → {leg.arr}
                      </div>
                      <div style={{fontSize:10,color:"#4d5669"}}>
                        {leg.date} (±{leg.flex} days)
                        {isDone && selected && (
                          <span style={{marginLeft:8,color:"#4ade80"}}>
                            — Selected: {selected.segments.map(s=>s.mktCx).join("/")} ${selected.totalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                    {isDone && (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span className="ui" style={{fontSize:16,fontWeight:700,color:"#c2850c"}}>
                          ${selected.totalPrice}
                        </span>
                        <span className="btn2" style={{padding:"4px 8px",fontSize:9}}>Change</span>
                      </div>
                    )}
                    {isFuture && <span style={{fontSize:10,color:"#2d3548",fontStyle:"italic"}}>Pending</span>}
                    {isActive && searching && <span className="pulse" style={{fontSize:10,color:"#c2850c"}}>Searching…</span>}
                  </div>

                  {/* Results for active leg */}
                  {isActive && !searching && (legResults[idx]?.length > 0 || legResults[idx]) && (
                    <div className="fi" style={{marginTop:8}}>
                      {/* Filters */}
                      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8,padding:"0 4px",flexWrap:"wrap"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span className="ui" style={{fontSize:9,color:"#4d5669",textTransform:"uppercase",letterSpacing:"0.05em"}}>Sort</span>
                          <select className="ipt" style={{width:110,padding:"5px 8px",fontSize:11}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                            <option value="price">Price ↑</option>
                            <option value="duration">Duration ↑</option>
                            <option value="stops">Stops ↑</option>
                          </select>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span className="ui" style={{fontSize:9,color:"#4d5669",textTransform:"uppercase",letterSpacing:"0.05em"}}>Carriers</span>
                          <select className="ipt" style={{width:110,padding:"5px 8px",fontSize:11}} value={carrierFilter} onChange={e=>setCarrierFilter(e.target.value)}>
                            <option value="all">All</option>
                            <option value="us">US Only</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span className="ui" style={{fontSize:9,color:"#4d5669",textTransform:"uppercase",letterSpacing:"0.05em"}}>Class</span>
                          <select className="ipt" style={{width:130,padding:"5px 8px",fontSize:11}} value={classFilter} onChange={e=>setClassFilter(e.target.value)}>
                            <option value="all">All</option>
                            <option value="mixed">Mixed Cabin</option>
                            <option value="C">Business</option>
                            <option value="Y">Economy</option>
                          </select>
                        </div>
                        <span className="ui" style={{fontSize:10,color:"#4d5669",marginLeft:"auto"}}>
                          {currentResults.length} options
                        </span>
                      </div>

                      {/* Flight cards */}
                      <div className="scroll" style={{display:"flex",flexDirection:"column",gap:6}}>
                        {currentResults.slice(0,40).map(flight => (
                          <div key={flight.id} className="card"
                            onClick={() => selectFlight(idx, flight)}
                            style={{padding:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                                {flight.compliance.compliant
                                  ? <span className="badge bg-ok">✓ Compliant</span>
                                  : <span className="badge bg-no">✕ Non-compliant</span>
                                }
                                {flight.stops > 0 && <span className="badge bg-dim">{flight.stops} stop{flight.stops>1?"s":""}</span>}
                                {flight.isGateway && <span className="badge bg-gw">via {flight.gatewayCode}</span>}
                                {flight.isMixedCabin && <span className="badge bg-info">Biz + Econ final</span>}
                                <span style={{fontSize:10,color:"#4d5669"}}>{flight.date}</span>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:18,fontWeight:700,color:"#c2850c",fontFamily:"'DM Mono',monospace"}}>
                                  ${flight.totalPrice.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* Segments inline */}
                            <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap",marginBottom:4}}>
                              {flight.segments.map((seg,si) => (
                                <span key={si} style={{display:"flex",alignItems:"center",gap:3}}>
                                  {si===0 && <span style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>{seg.dep}</span>}
                                  <span style={{
                                    padding:"1px 5px",borderRadius:3,fontSize:10,fontWeight:700,
                                    background:US_CARRIERS.includes(seg.mktCx)?"rgba(34,197,94,0.1)":"rgba(168,85,247,0.1)",
                                    color:US_CARRIERS.includes(seg.mktCx)?"#4ade80":"#c084fc",
                                  }}>
                                    {seg.mktCx}{seg.codeCx && <span style={{color:"#38bdf8"}}> ({seg.codeCx})</span>}
                                  </span>
                                  <span style={{color:"#2d3548",fontSize:10}}>→</span>
                                  <span style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>{seg.arr}</span>
                                </span>
                              ))}
                            </div>
                            <div style={{fontSize:10,color:"#4d5669"}}>
                              {flight.segments.map((s,i) => (
                                <span key={i}>
                                  {i > 0 && " · "}
                                  {s.flt} {s.depTime} ({s.dur})
                                  <span style={{color:CABINS.find(c=>c.code===s.cabin)?.color, fontWeight:600}}>
                                    {" "}{CABINS.find(c=>c.code===s.cabin)?.short}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {currentResults.length === 0 && (
                          <div style={{textAlign:"center",padding:30,color:"#4d5669"}}>
                            <div className="ui" style={{fontSize:12}}>No results match filters. Try disabling "Compliant only" to see all options.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== SUMMARY ===== */}
        {tab === "summary" && (
          <div className="fi">
            {!allLegsSelected ? (
              <div style={{textAlign:"center",padding:50,color:"#4d5669"}}>
                <div style={{fontSize:36,marginBottom:10}}>📋</div>
                <div className="ui" style={{fontSize:13}}>
                  Select flights for all {legs.length} legs to see your full itinerary summary.
                </div>
                <button className="btn2" style={{marginTop:12}} onClick={()=>setTab("legs")}>
                  Go to Flight Selection
                </button>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"5fr 3fr",gap:18}}>
                {/* Left: Full itinerary */}
                <div>
                  <div className="glass" style={{padding:18,marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                      <div className="ui" style={{fontSize:15,fontWeight:700,color:"#e2e8f0"}}>Complete Itinerary</div>
                      <div style={{fontSize:24,fontWeight:700,color:"#c2850c",fontFamily:"'DM Mono',monospace"}}>
                        ${totalSelected.toLocaleString()}
                      </div>
                    </div>

                    {legs.map((leg, idx) => {
                      const sel = legSelections[idx];
                      if (!sel) return null;
                      return (
                        <div key={idx} style={{marginBottom:16}}>
                          <div className="ui" style={{
                            fontSize:10,fontWeight:600,color:["#c2850c","#0ea5e9","#a855f7","#4ade80","#f87171"][idx%5],
                            letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8,
                          }}>
                            Leg {idx+1} · {leg.date} · ${sel.totalPrice}
                          </div>
                          {sel.segments.map((seg, si) => (
                            <div key={si} style={{
                              display:"flex",alignItems:"center",gap:12,padding:"10px 0",
                              borderBottom:si<sel.segments.length-1?"1px solid rgba(148,163,184,0.05)":"none",
                            }}>
                              <div style={{
                                width:24,height:24,borderRadius:"50%",display:"flex",
                                alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,
                                background:US_CARRIERS.includes(seg.mktCx)?"rgba(34,197,94,0.12)":"rgba(168,85,247,0.12)",
                                color:US_CARRIERS.includes(seg.mktCx)?"#4ade80":"#c084fc",
                              }}>{si+1}</div>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                                  <span style={{fontWeight:700,fontSize:15,color:"#e2e8f0"}}>{seg.dep}</span>
                                  <div style={{flex:1,height:1,background:"rgba(148,163,184,0.1)",position:"relative"}}>
                                    <span style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",
                                      background:"#0b1120",padding:"0 6px",fontSize:9,color:"#4d5669"}}>{seg.dur}</span>
                                  </div>
                                  <span style={{fontWeight:700,fontSize:15,color:"#e2e8f0"}}>{seg.arr}</span>
                                </div>
                                <div style={{display:"flex",gap:10,fontSize:10,color:"#8b949e"}}>
                                  <span style={{color:US_CARRIERS.includes(seg.mktCx)?"#4ade80":"#c084fc",fontWeight:600}}>
                                    {seg.mktCx}
                                  </span>
                                  <span>{seg.flt}</span>
                                  <span>{seg.airline}</span>
                                  <span>{seg.depTime}→{seg.arrTime}</span>
                                  <span>{seg.aircraft}</span>
                                  <span style={{color:CABINS.find(c=>c.code===seg.cabin)?.color}}>
                                    {CABINS.find(c=>c.code===seg.cabin)?.label}
                                  </span>
                                  <span>${seg.price}</span>
                                </div>
                                {seg.codeCx && (
                                  <div style={{fontSize:9,color:"#38bdf8",marginTop:2}}>
                                    ↳ Codeshare: {seg.codeCx} flight number on ticket
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Compliance + Cost */}
                <div>
                  {/* Compliance summary */}
                  <div className="glass" style={{padding:18,marginBottom:14}}>
                    <div className="ui" style={{fontSize:13,fontWeight:600,color:"#e2e8f0",marginBottom:12}}>
                      Fly America Compliance
                    </div>
                    {legs.map((leg, idx) => {
                      const sel = legSelections[idx];
                      if (!sel) return null;
                      return (
                        <div key={idx} style={{marginBottom:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <span style={{fontSize:12,color:sel.compliance.compliant?"#4ade80":"#f87171"}}>
                              {sel.compliance.compliant?"✓":"✕"}
                            </span>
                            <span className="ui" style={{fontSize:11,fontWeight:600,color:"#c9d1d9"}}>
                              Leg {idx+1}: {leg.dep}→{leg.arr}
                            </span>
                            {sel.compliance.compliant
                              ? <span className="badge bg-ok">Compliant</span>
                              : <span className="badge bg-no">Issue</span>
                            }
                          </div>
                          {sel.compliance.issues.map((iss,i) => (
                            <div key={i} style={{fontSize:10,color:"#f87171",padding:"4px 8px",marginLeft:20,
                              background:"rgba(239,68,68,0.05)",borderRadius:3,marginBottom:2,
                              borderLeft:"2px solid rgba(239,68,68,0.2)"}}>
                              {iss}
                            </div>
                          ))}
                          {sel.compliance.warnings.map((w,i) => (
                            <div key={i} style={{fontSize:10,color:"#fbbf24",padding:"4px 8px",marginLeft:20,
                              background:"rgba(245,158,11,0.05)",borderRadius:3,marginBottom:2,
                              borderLeft:"2px solid rgba(245,158,11,0.2)"}}>
                              {w}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Cost construction */}
                  {showCostConstruct && authFare > 0 && (
                    <div className="glass" style={{padding:18}}>
                      <div className="ui" style={{fontSize:13,fontWeight:600,color:"#e2e8f0",marginBottom:14}}>
                        Cost Construction
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                        <div style={{padding:12,background:"rgba(22,27,45,0.5)",borderRadius:6,textAlign:"center"}}>
                          <div style={{fontSize:9,color:"#4d5669",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>
                            Authorized Fare
                          </div>
                          <div style={{fontSize:20,fontWeight:700,color:"#8b949e"}}>${authFare.toLocaleString()}</div>
                        </div>
                        <div style={{padding:12,background:"rgba(22,27,45,0.5)",borderRadius:6,textAlign:"center"}}>
                          <div style={{fontSize:9,color:"#4d5669",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>
                            Your Itinerary
                          </div>
                          <div style={{fontSize:20,fontWeight:700,color:"#c2850c"}}>${totalSelected.toLocaleString()}</div>
                        </div>
                        <div style={{
                          padding:14,borderRadius:6,textAlign:"center",
                          background:totalSelected<=authFare?"rgba(34,197,94,0.06)":"rgba(239,68,68,0.06)",
                          border:`1px solid ${totalSelected<=authFare?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"}`,
                        }}>
                          <div style={{fontSize:9,color:"#4d5669",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>
                            {totalSelected<=authFare?"Government covers full cost":"Out-of-Pocket"}
                          </div>
                          <div style={{
                            fontSize:24,fontWeight:700,
                            color:totalSelected<=authFare?"#4ade80":"#f87171",
                          }}>
                            {totalSelected<=authFare
                              ? `−$${(authFare-totalSelected).toLocaleString()}`
                              : `+$${(totalSelected-authFare).toLocaleString()}`
                            }
                          </div>
                          <div style={{fontSize:10,color:"#8b949e",marginTop:4}}>
                            {totalSelected<=authFare
                              ? "Your trip costs less than authorized. No personal expense."
                              : "You pay the difference above authorized amount."
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== RULES ===== */}
        {tab === "rules" && (
          <div className="fi" style={{maxWidth:760}}>
            <div className="glass" style={{padding:22}}>
              <div className="hd" style={{fontSize:26,color:"#f0f3f6",marginBottom:18}}>
                Fly America Act — Quick Reference
              </div>

              {[
                { title: "Core Requirement", text: "Federal travelers must use U.S. flag air carrier service for all air travel funded by the U.S. Government (49 U.S.C. § 40118). A U.S. flag carrier holds a certificate under 49 U.S.C. § 41102." },
                { title: "Critical Segments", text: "The first flight arriving on US soil (inbound) and the last flight departing US soil (outbound) MUST be on a US flag carrier or a US flag codeshare. All intermediate US-touching segments should also comply." },
                { title: "Codeshare Compliance", text: "A flight operated by a foreign carrier but marketed under a US carrier code satisfies Fly America — the US carrier code must appear on the ticket. Example: LATAM-operated flight with an AA flight number satisfies the requirement." },
                { title: "Open Skies / EU Exception", text: "EU/EEA carriers may be used between the US and EU/EEA states under Open Skies agreements. This does NOT apply to US–South America travel. GRU→US routing requires US flag carriers." },
                { title: "Cost Construction", text: "When desired routing differs from authorized, the government pays the lesser of: (a) the authorized fare or (b) the actual fare. The traveler pays any excess. This tool calculates that delta per leg and total." },
                { title: "Gateway Strategy (Canada/Mexico)", text: "Route through Canadian or Mexican airports on foreign carriers in premium cabins (e.g., business GRU→YYZ on Air Canada), then a short US-carrier hop into the US (YYZ→IAD on United). The foreign segment doesn't touch US soil, so Fly America doesn't apply. The final US-arriving segment uses a US carrier." },
              ].map(({title, text}, i) => (
                <div key={i} style={{marginBottom:16}}>
                  <div className="ui" style={{fontSize:12,fontWeight:600,color:"#c2850c",marginBottom:5}}>{title}</div>
                  <div style={{fontSize:12,color:"#a1aab5",lineHeight:1.7}}>{text}</div>
                </div>
              ))}

              <div style={{
                padding:12,borderRadius:6,marginTop:8,
                background:"rgba(194,133,12,0.04)",border:"1px solid rgba(194,133,12,0.12)",
              }}>
                <div className="ui" style={{fontSize:10,color:"#c2850c",fontWeight:600,marginBottom:3}}>⚠ Disclaimer</div>
                <div style={{fontSize:10,color:"#8b949e",lineHeight:1.6}}>
                  Planning tool only. Verify with your agency travel office, the Federal Travel Regulation (FTR), and your specific travel authorization. Rules may vary by agency and travel orders.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
