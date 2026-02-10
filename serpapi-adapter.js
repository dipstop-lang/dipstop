// ============================================================
// serpapi-adapter.js
// Maps SerpApi Google Flights responses → FlyRight data model
// ============================================================

const SERPAPI_BASE = "https://serpapi.com/search.json";

// US flag carriers (IATA 2-letter codes)
const US_CARRIERS = ["AA", "DL", "UA", "WN", "B6", "AS", "NK", "F9", "HA", "SY"];

// Known codeshare mappings (foreign carrier → US partner on ticket)
// SerpApi gives us "ticket_also_sold_by" which helps detect these
const CODESHARE_MAP = {
  LA: ["AA"], // LATAM → American
  AV: ["UA"], // Avianca → United
  AC: ["UA"], // Air Canada → United
  AM: ["DL"], // Aeromexico → Delta
  BA: ["AA"], // British Airways → American
  IB: ["AA"], // Iberia → American
  QF: ["AA"], // Qantas → American
  LH: ["UA"], // Lufthansa → United
  AF: ["DL"], // Air France → Delta
  KL: ["DL"], // KLM → Delta
  AR: ["AA"], // Aerolineas Argentinas → American
  CM: ["UA"], // Copa → United
  JL: ["AA"], // Japan Airlines → American
  NH: ["UA"], // ANA → United
  KE: ["DL"], // Korean Air → Delta
  VS: ["DL"], // Virgin Atlantic → Delta
};

// Cabin class mapping: SerpApi text → FlyRight code
const CABIN_MAP = {
  "Economy": "Y",
  "Premium Economy": "W",
  "Premium economy": "W",
  "Business": "C",
  "First": "F",
  "First Class": "F",
};

// Parse "UA 1234" → { code: "UA", number: "UA1234" }
function parseFlightNumber(fltStr) {
  if (!fltStr) return { code: "??", number: fltStr || "??" };
  const parts = fltStr.trim().split(/\s+/);
  const code = parts[0] || "??";
  const num = parts.slice(1).join("") || "";
  return { code, number: `${code}${num}` };
}

// Duration in minutes → "Xh Ym"
function formatDuration(minutes) {
  if (!minutes) return "?h ?m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// Parse time from "2026-04-15 14:30" → "14:30"
function parseTime(dateTimeStr) {
  if (!dateTimeStr) return "??:??";
  const parts = dateTimeStr.split(" ");
  return parts[1] || "??:??";
}

// Parse date from "2026-04-15 14:30" → "2026-04-15"
function parseDate(dateTimeStr) {
  if (!dateTimeStr) return "";
  return dateTimeStr.split(" ")[0] || "";
}

// Detect if an airport code is in the US
function isUS(code) {
  // This is a simplified check; the frontend has a full airport DB
  // We'll pass a flag from the frontend or maintain a list
  return US_AIRPORTS.has(code);
}

// Common US airports (extend as needed — frontend has full list)
const US_AIRPORTS = new Set([
  "ATL","LAX","ORD","DFW","DEN","JFK","SFO","SEA","LAS","MCO",
  "EWR","MIA","CLT","PHX","IAH","BOS","MSP","FLL","DTW","PHL",
  "LGA","BWI","SLC","DCA","IAD","SAN","TPA","BNA","AUS","STL",
  "HNL","PDX","MCI","RDU","CLE","SMF","MKE","OAK","SNA","IND",
  "PIT","CMH","SAT","ABQ","SJC","RSW","TUS","OGG","PBI","RIC",
  "CVG","BDL","JAX","OMA","BUF","BUR","ONT","PVD","ORF","GRR",
  "TUL","OKC","ALB","LIT","SDF","MSY","MEM","RNO","ELP","BOI",
  "ANC","GSO","DSM","ROC","TYS","CHS","SYR","SAV","FNT","MDW",
  "KOA","LIH","FAI","JNU","HLN","BIL","MSO","GTF","BZN","FCA",
  "GSP","BHM","HSV","JAN","ICT","LEX","PWM","BTV","MHT","GEG",
  "SBN","GNV","TLH","PNS","DAB","SRQ","CHA","GSO","ILM","MYR",
  "CAE","AGS","SHV","BTR","MOB","MGM","SGF","XNA","DAY","CAK",
  "MDT","ABE","AVL","FNT","TVC","CID","MLI","PIA","SPI","EVV",
  "FWA","CRW","SJU","STT","STX","GUM","LBB","MAF","AMA","COS",
  "RAP","FSD","FAR","BIS","LAN","MSN","FCA","GRR","PIT",
]);

// CA/MX gateway airports
const GATEWAY_AIRPORTS = new Set([
  "YYZ","YUL","YVR","YOW","YYC","YEG","YWG", // Canada
  "MEX","CUN","GDL","MTY","SJD","PVR",         // Mexico
]);

// ============================================================
// MAIN ADAPTER: Convert SerpApi response → FlyRight results[]
// ============================================================
function adaptSerpApiResponse(serpData, options = {}) {
  const { creativeBusinessClass = false, searchDate = "", requestedCabin = "Y" } = options;
  const results = [];

  // SerpApi returns "best_flights" and "other_flights" arrays
  const allFlightGroups = [
    ...(serpData.best_flights || []),
    ...(serpData.other_flights || []),
  ];

  for (const group of allFlightGroups) {
    const segments = [];
    let totalPrice = group.price || 0;
    let totalMin = group.total_duration || 0;

    if (!group.flights || group.flights.length === 0) continue;

    for (let i = 0; i < group.flights.length; i++) {
      const f = group.flights[i];
      const { code: mktCx, number: flt } = parseFlightNumber(f.flight_number);

      // Detect operating carrier vs marketing carrier
      // SerpApi provides "plane_and_crew_by" for codeshares
      const operatingCarrier = f.plane_and_crew_by || null;
      
      // Determine codeshare: if the marketing carrier is foreign,
      // check if there's a US carrier codeshare
      let codeCx = null;
      if (!US_CARRIERS.includes(mktCx)) {
        // Check "ticket_also_sold_by" for US carriers
        if (f.ticket_also_sold_by && Array.isArray(f.ticket_also_sold_by)) {
          for (const seller of f.ticket_also_sold_by) {
            // seller might be airline name; we'd need to reverse-map
            // For now, use our known codeshare map
            const partners = CODESHARE_MAP[mktCx];
            if (partners) { codeCx = partners[0]; break; }
          }
        }
        // Fallback to known codeshare map
        if (!codeCx && CODESHARE_MAP[mktCx]) {
          codeCx = CODESHARE_MAP[mktCx][0];
        }
      }

      // Cabin class — use SerpApi's travel_class if provided, else fall back to what we searched for
      const cabin = f.travel_class ? (CABIN_MAP[f.travel_class] || requestedCabin) : requestedCabin;

      // Per-segment price: SerpApi only gives total price per itinerary,
      // not per segment. We estimate proportionally by duration.
      const segDuration = f.duration || 0;
      const segPrice = totalMin > 0
        ? Math.round(totalPrice * (segDuration / totalMin))
        : Math.round(totalPrice / group.flights.length);

      segments.push({
        dep: f.departure_airport?.id || "???",
        arr: f.arrival_airport?.id || "???",
        mktCx,
        codeCx,
        operatingCx: operatingCarrier,
        airline: f.airline || mktCx,
        flt,
        depTime: parseTime(f.departure_airport?.time),
        arrTime: parseTime(f.arrival_airport?.time),
        dur: formatDuration(f.duration),
        durationMin: f.duration || 0,
        date: parseDate(f.departure_airport?.time),
        cabin,
        price: segPrice,
        aircraft: f.airplane || "",
        legroom: f.legroom || "",
        extensions: f.extensions || [],
        overnight: f.overnight || false,
        oftenDelayed: f.often_delayed_by_over_30_min || false,
      });
    }

    // Route analysis
    const route = [segments[0]?.dep, ...segments.map(s => s.arr)];
    const stops = segments.length - 1;

    // Gateway detection: intermediate stop in CA/MX
    const intermediateStops = route.slice(1, -1);
    const isGateway = intermediateStops.some(code => GATEWAY_AIRPORTS.has(code));
    const gatewayCode = isGateway
      ? intermediateStops.find(code => GATEWAY_AIRPORTS.has(code))
      : null;

    // Mixed cabin detection for creative business class
    const cabins = segments.map(s => s.cabin);
    const isMixedCabin = cabins.some(c => c === "C" || c === "F") && cabins.some(c => c === "Y" || c === "W");

    // Compliance check
    const compliance = checkCompliance(segments);

    // Determine the date (first segment departure)
    const date = segments[0]?.date || searchDate;

    results.push({
      id: `serp-${date}-${route.join("")}-${segments.map(s=>s.mktCx).join("")}-${Math.random().toString(36).substr(2,6)}`,
      segments,
      totalPrice,
      date,
      cabin: segments[0]?.cabin || "Y",
      stops,
      routeDesc: route.join(" → "),
      isGateway,
      gatewayCode,
      isMixedCabin,
      compliance,
      totalMin,
      // Extra SerpApi data
      carbonEmissions: group.carbon_emissions || null,
      layovers: group.layovers || [],
    });
  }

  return results;
}

// ============================================================
// COMPLIANCE CHECK (mirrors frontend logic)
// ============================================================
function checkCompliance(segments) {
  const issues = [];
  const warnings = [];
  let compliant = true;

  const firstUSArr = segments.find(s => isUS(s.arr));
  const lastUSDep = [...segments].reverse().find(s => isUS(s.dep));

  const checkSeg = (seg, desc) => {
    const ok = US_CARRIERS.includes(seg.mktCx) ||
      (seg.codeCx && US_CARRIERS.includes(seg.codeCx));
    if (!ok) {
      compliant = false;
      issues.push(`${desc}: ${seg.dep}→${seg.arr} on ${seg.mktCx} (${seg.airline}) — needs US flag carrier or US codeshare`);
    }
  };

  if (firstUSArr) checkSeg(firstUSArr, "First US-arriving segment");
  if (lastUSDep) checkSeg(lastUSDep, "Last US-departing segment");

  // Warn about intermediate US-touching segments on foreign carriers
  segments.forEach((seg, i) => {
    if (seg === firstUSArr || seg === lastUSDep) return;
    if ((isUS(seg.dep) || isUS(seg.arr)) &&
        !US_CARRIERS.includes(seg.mktCx) &&
        !(seg.codeCx && US_CARRIERS.includes(seg.codeCx))) {
      warnings.push(`Seg ${i+1} (${seg.dep}→${seg.arr}) on foreign carrier ${seg.mktCx} touches US soil`);
    }
  });

  return { compliant, issues, warnings };
}

// ============================================================
// SERPAPI SEARCH FUNCTION
// ============================================================
async function searchFlights(apiKey, params) {
  const {
    depAirport,
    arrAirport,
    date,           // "YYYY-MM-DD"
    cabin = 1,      // 1=Economy, 2=Premium Economy, 3=Business, 4=First
    adults = 1,
    stops = 0,      // 0=any, 1=nonstop, 2=1stop, 3=2stops
    includeAirlines = null,  // e.g. "UA,AA,DL" for US carriers
    maxPrice = null,
  } = params;

  const queryParams = new URLSearchParams({
    engine: "google_flights",
    api_key: apiKey,
    departure_id: depAirport,
    arrival_id: arrAirport,
    outbound_date: date,
    type: "2",  // one-way (we search leg by leg)
    travel_class: String(cabin),
    adults: String(adults),
    currency: "USD",
    hl: "en",
    gl: "us",
  });

  if (stops > 0) queryParams.set("stops", String(stops));
  if (includeAirlines) queryParams.set("include_airlines", includeAirlines);
  if (maxPrice) queryParams.set("max_price", String(maxPrice));

  const url = `${SERPAPI_BASE}?${queryParams.toString()}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${errText}`);
  }

  return response.json();
}

// ============================================================
// HIGH-LEVEL: Search a single leg with flex dates
// Returns FlyRight-compatible results[]
//
// QUERY BUDGET (to control SerpApi costs):
//   flex=0: 1 main + (CBC? 2 gateways × 2) = max 5 queries
//   flex=1: 3 main + (CBC? 3 dates × 2 gateways × 2) = max 15 queries
//   flex=2: 5 main + (CBC? 5 dates × 2 gateways × 2) = max 25 queries
//   flex=3: 7 main + (CBC? 3 center dates × 2 gateways × 2) = max 19 queries
// ============================================================
async function searchLeg(apiKey, {
  dep, arr, date, flex = 0,
  cabin = "Y", creativeBusinessClass = false,
}) {
  // Map FlyRight cabin codes to SerpApi travel_class numbers
  const cabinNum = { Y: 1, W: 2, C: 3, F: 4 }[cabin] || 1;
  const allResults = [];
  let queryCount = 0;

  // Generate flex date range
  const baseDate = new Date(date);
  const dates = [];
  for (let offset = -flex; offset <= flex; offset++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    dates.push(d.toISOString().split("T")[0]);
  }

  // SerpApi stops parameter: 0=any, 1=nonstop only, 2=up to 1 stop, 3=up to 2 stops
  // We enforce max 1 stop (value 2) to keep results practical
  const maxStops = 2;

  // Search each date
  for (const searchDate of dates) {
    try {
      const serpData = await searchFlights(apiKey, {
        depAirport: dep,
        arrAirport: arr,
        date: searchDate,
        cabin: cabinNum,
        stops: maxStops,
      });
      queryCount++;

      const results = adaptSerpApiResponse(serpData, {
        creativeBusinessClass,
        searchDate,
        requestedCabin: cabin, // Pass so we can force cabin if SerpApi omits it
      });
      allResults.push(...results);

      // Small delay between searches
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`Search failed for ${dep}→${arr} on ${searchDate}:`, err.message);
    }
  }

  // Creative Business Class: search via top 2 gateways only
  // Only search center date + ±1 day (max 3 dates) to limit queries
  if (creativeBusinessClass) {
    const gateways = pickBestGateways(dep, arr, 2);
    const cbcDates = dates.length <= 3 ? dates : [
      dates[Math.max(0, Math.floor(dates.length/2) - 1)],
      dates[Math.floor(dates.length/2)],
      dates[Math.min(dates.length - 1, Math.floor(dates.length/2) + 1)],
    ];

    for (const searchDate of cbcDates) {
      for (const gw of gateways) {
        try {
          // Search dep → gateway in business (max 1 stop)
          const gwData = await searchFlights(apiKey, {
            depAirport: dep,
            arrAirport: gw,
            date: searchDate,
            cabin: 3,
            stops: maxStops,
          });
          queryCount++;

          // Search gateway → arr in economy (max 1 stop)
          const finalData = await searchFlights(apiKey, {
            depAirport: gw,
            arrAirport: arr,
            date: searchDate,
            cabin: 1,
            stops: maxStops,
          });
          queryCount++;

          // Combine: take top 2 of each to limit combinations
          const gwResults = adaptSerpApiResponse(gwData, {
            searchDate,
            requestedCabin: "C",
          });
          const finalResults = adaptSerpApiResponse(finalData, {
            searchDate,
            requestedCabin: "Y",
          });

          if (gwResults.length > 0 && finalResults.length > 0) {
            const topGw = gwResults.slice(0, 2);
            const topFinal = finalResults.slice(0, 2);

            for (const gRes of topGw) {
              for (const fRes of topFinal) {
                const combinedSegs = [...gRes.segments, ...fRes.segments];
                const combinedPrice = gRes.totalPrice + fRes.totalPrice;
                const combinedMin = gRes.totalMin + fRes.totalMin;
                const route = [combinedSegs[0].dep, ...combinedSegs.map(s => s.arr)];

                allResults.push({
                  id: `gw-${searchDate}-${gw}-${Math.random().toString(36).substr(2,6)}`,
                  segments: combinedSegs,
                  totalPrice: combinedPrice,
                  date: searchDate,
                  cabin: "C",
                  stops: combinedSegs.length - 1,
                  routeDesc: route.join(" → "),
                  isGateway: true,
                  gatewayCode: gw,
                  isMixedCabin: true,
                  compliance: checkCompliance(combinedSegs),
                  totalMin: combinedMin,
                });
              }
            }
          }

          await new Promise(r => setTimeout(r, 200));

        } catch (gwErr) {
          console.warn(`Gateway ${gw} search failed:`, gwErr.message);
        }
      }
    }
  }

  console.log(`searchLeg ${dep}→${arr}: ${queryCount} SerpApi queries, ${allResults.length} results`);

  // Deduplicate by route+carrier+price
  const seen = new Set();
  const deduped = allResults.filter(r => {
    const key = `${r.routeDesc}-${r.segments.map(s=>s.flt).join(",")}-${r.totalPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => a.totalPrice - b.totalPrice);
  return { results: deduped, queryCount };
}

// Pick the best N gateway airports based on origin/destination geography
function pickBestGateways(dep, arr, count = 2) {
  // All gateways ranked by general utility
  const allGateways = ["YYZ", "YUL", "YVR", "MEX", "CUN"];

  // Filter out origin/destination
  const available = allGateways.filter(gw => gw !== dep && gw !== arr);

  // Simple geographic preference:
  // West Coast origin? Prefer YVR, MEX
  // East Coast origin? Prefer YYZ, YUL
  // Otherwise: YYZ + MEX as most connected
  return available.slice(0, count);
}

module.exports = {
  searchLeg,
  searchFlights,
  adaptSerpApiResponse,
  checkCompliance,
  US_CARRIERS,
  CODESHARE_MAP,
  CABIN_MAP,
  US_AIRPORTS,
  GATEWAY_AIRPORTS,
};
