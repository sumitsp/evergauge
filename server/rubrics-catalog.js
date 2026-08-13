/** Evernile IB quality rubrics — sourced from Quality Rubrics_IB Material_Evernile.xlsx */

export const DOC_TYPE_RUBRICS = [
  {
    name: "Teaser",
    short_label: "Teaser",
    sla_days: 2,
    sla_note: "2 working days from source-doc receipt",
    dimensions: [
      {
        key: "Data Accuracy & Sourcing",
        guides: [
          "Unsourced or fabricated numbers. Same figure differs across sections. Reader cannot trust the analysis.",
          "Most numbers present but unsourced. Reconciliation errors. Forward and historical mixed without labels.",
          "Numbers sourced but partial. A few gaps or unlabelled bases. Occasional inconsistency across sections.",
          "All numbers sourced with period and basis stated. Consistent across the document. Forward labelled as estimates.",
          "Every number traces to source doc. A/P/E labels on every table. Reconciled across every section and every KPI tile. Anchor contract value rounded if fingerprinting risk.",
        ],
      },
      {
        key: "Anonymity Discipline",
        guides: [
          "Company name visible in body, header, or image. Multiple identifiers (promoter name, anchor client, city, auditor) present.",
          "Company name removed. Promoter, anchor client, or specific geography still traceable.",
          "Most identifiers removed. One or two fingerprints remain (specific city, unusual asset count, marquee logo).",
          "All named identifiers removed. Description could still fingerprint on second read.",
          "Codename applied. Only described by type and scale only. No searchable heritage or award detail.",
        ],
      },
      {
        key: "Section Completeness",
        guides: [
          "Fewer than 5 of 8 sections present. Ask absent. Reader cannot navigate.",
          "5 to 6 of 8 sections. Anchor callout or use-of-funds missing. Ordering off.",
          "All major sections present. Some sub-blocks thin. Order broadly correct.",
          "All 8 sections in canonical order. Adviser contact and NDA gate present.",
          "All 8 sections (masthead + 01 opportunity, 02 problem/solution, 03 business model, 04 traction, 05 anchor/key differentiator, 06 market, 07 financials, 08 ask). 3 to 4 pages, no orphaned trailing page.",
        ],
      },
      {
        key: "Narrative & Positioning",
        guides: [
          "No thesis. Product feature list. Founder-lens throughout.",
          "Weak thesis. Founder-lens dominant. Investor perspective absent.",
          "Clear thesis. Predominantly investor-lens. Some sections still founder-framed.",
          "Sharp one-line thesis threaded across 2 to 3 sections. Consistent investor-lens.",
          "One-line thesis in subtitle threaded through the anchor callout and the risk table. De-risking spine (contracted anchor, visibility, market position) visible on every page.",
        ],
      },
      {
        key: "Sector KPIs & Benchmarks",
        guides: [
          "Generic revenue-only KPIs. No sector context.",
          "Basic sector mention. A few KPIs but not the highest-signal ones.",
          "Right sector KPIs present. Multiples not shown.",
          "Correct sector KPI set. Multiples range shown.",
          "Full Evernile sector KPI set (hospitals: occupancy, ARPOB, payor mix; pharma: PCPM, chronic mix; D2C: LTV:CAC, repeat; SaaS: NDR, Rule of 40). Sub-sector multiples with named generic comps.",
        ],
      },
      {
        key: "Risk & Compliance",
        guides: [
          "No risk section. No or thin disclaimer.",
          "Generic risks without mitigants. Thin one-line disclaimer.",
          "3 to 4 risks. Standard disclaimer.",
          "4 to 5 risks with mitigants. Full disclaimer.",
          "Risk table pre-empts top 3 items diligence will surface, each with a quantified mitigant. Full disclaimer: advisor line, no-names basis, not-an-offer, do-not-contact, NDA gate.",
        ],
      },
      {
        key: "Formatting Consistency",
        guides: [
          "Inconsistent fonts, sizes, spacing throughout. Broken tables. Text overflow.",
          "Multiple format drifts. Misaligned tables. Page overflow.",
          "Formatting mostly consistent. Minor drifts.",
          "Consistent formatting. One or two imperfections.",
          "Font, size, spacing per Evernile spec on every page. Tables aligned with headers formatted. Page count 3 to 4 with no orphaned page. Footer and page numbering consistent. File named per convention.",
        ],
      },
      {
        key: "Design",
        is_manual: true,
        guides: [
          "No visual hierarchy. Crowded or empty pages. Off-brand colours. Unreadable charts or icons.",
          "Weak layout. Inconsistent visual system. Charts hard to scan. Brand elements applied unevenly.",
          "Acceptable layout and brand use. Charts readable. Some pages still look template-generic.",
          "Clean visual hierarchy. Consistent Evernile look. Charts and callouts support the story.",
          "Polished IB-grade design. Strong hierarchy, whitespace, and brand craft. Every visual earns its place and elevates the narrative.",
        ],
      },
      {
        key: "Timeline & Turnaround (2 days)",
        is_manual: true,
        guides: [
          "Delivered more than 48 hours late. Or on time with full rework required. Silent until reviewer chased.",
          "Delivered on Day 3 after 2 or more extension requests. Iterations poorly absorbed.",
          "Delivered on Day 2 with reviewer chase. One extension. Iterations required reminders.",
          "Delivered on Day 2 as promised. Iterations absorbed cleanly within 8 hours.",
          "Delivered on Day 1 or early Day 2 with buffer for review. Iterations turned within 4 hours. Proactive on gaps, dependencies, and edge cases before reviewer asks.",
        ],
      },
    ],
  },
  {
    name: "Information Memorandum (IM/CIM)",
    short_label: "IM/CIM",
    sla_days: 14,
    sla_note: "14 working days from mandate kickoff",
    dimensions: [
      {
        key: "Data Accuracy & Consistency",
        guides: [
          "Contradictions between slides. Unsourced market claims. Revenue basis inconsistent.",
          "Some contradictions. Many claims unsourced. Basis (gross/net/MRP) not labelled.",
          "Consistent numbers but partial sourcing. Occasional basis unlabelled.",
          "Consistent across slides. All sources cited with year. Forward figures labelled.",
          "Single-source-of-truth data file. Every repeated figure identical everywhere. Sum of mix percentages equals 100 on every mix chart. Revenue basis (gross/net/MRP/invoice) labelled every appearance.",
        ],
      },
      {
        key: "Section Coverage",
        guides: [
          "Fewer than 30 slides. Multiple sections missing. Sector core block absent.",
          "30 to 40 slides. Sector core block absent or thin. Adjusted EBITDA bridge missing.",
          "40 to 48 slides. All major sections present. Some sub-sections thin.",
          "48 to 55 slides. All core sections present in correct order. Appendix is mostly complete, with only a small gap or thin sub-section.",
          "48 to 55 slides plus full appendix. Sector core block (Slides 19 to 22) matches the mandate well. Adjusted EBITDA bridge, transaction structure diagram, and use-of-proceeds mapping are all present.",
        ],
      },
      {
        key: "Analytical Depth & Modelability",
        guides: [
          "No decomposition. Unit economics absent. Analyst cannot build a model from the IM.",
          "Shallow analysis. Drivers not exposed. Growth stated as one number.",
          "Standard analysis. Growth split at one dimension. Some drivers exposed.",
          "Full decomposition (volume, mix, capacity). Unit economics quantified. Enough detail for an analyst to build a credible first-pass model.",
          "External analyst can build a working 3-statement model from the IM alone with only limited follow-up. Growth waterfall reconciles cleanly to the projection. Cohort or ramp chart is present where relevant.",
        ],
      },
      {
        key: "Financial Analysis",
        guides: [
          "One-year snapshot only. No adjusted EBITDA bridge. No working capital view.",
          "3-year snapshot without projections or bridge. WC absent.",
          "3A+2P snapshot with basic assumption panel. WC days stated.",
          "5-year table plus adj EBITDA bridge plus WC days plus ageing. Core assumptions are exposed.",
          "5yr (3A+2P) with revenue, GP%, EBITDA%, adj EBITDA%, PAT, net debt, ROCE. Adjusted EBITDA bridge is materially reconciled and major add-backs are explained. DSO/DIO/DPO with ageing. EBITDA-to-OCF reconciliation. Base and conservative projection cases with delta drivers named.",
        ],
      },
      {
        key: "Narrative Quality",
        guides: [
          "Label titles ('Financials', 'Overview'). No thesis. No 'why now'.",
          "Occasional assertion titles. Weak thesis. 'Why now' generic.",
          "Half assertion titles. Clear thesis in executive summary. 'Why now' present.",
          "Most titles are assertions. Thesis threaded through sections. Six investment highlights.",
          "100% assertion titles with numbers ('Revenue compounded 34% with EBITDA margin expanding 480 bps'). One-sentence company description quotable and identical on Slides 1, 5, 7. Six investment highlights each cross-referenced to proving slide.",
        ],
      },
      {
        key: "Sector Expertise",
        guides: [
          "Generic KPIs. Wrong sub-sector multiples. No diligence pre-emption.",
          "Basic sector context. A few KPIs but not the highest-signal ones.",
          "Right sector framework. Correct KPI set. Multiples in range.",
          "Full sector KPI set. Correct sub-sector multiples with named comps. Common diligence points are pre-empted.",
          "Complete Evernile playbook applied. Sector core block Slides 19 to 22 matches the correct Part 3 module, and the main diligence-sensitive items for the sector are addressed explicitly (govt receivable ageing for hospitals; NLEM exposure for pharma; discount treatment for D2C; ARR definition for SaaS).",
        ],
      },
      {
        key: "Transaction Terms & Ask",
        guides: [
          "Ask absent or buried. Structure unclear.",
          "Ask stated in body without structure or timeline.",
          "Quantum plus basic structure. Use of proceeds stated.",
          "Full structure with promoter continuity, lock-in, timeline, adviser contact. Use of proceeds is mostly clear.",
          "Explicit quantum, indicative stake range, primary/secondary split, structure contemplated (equity/CCPS/mix), promoter continuity + lock-in, board composition, key rights, timeline, adviser contact. Use of proceeds is clearly mapped to growth levers. General corporate purposes stay limited.",
        ],
      },
      {
        key: "Formatting Consistency",
        guides: [
          "Inconsistent fonts, spacing, alignment. Typos. Broken tables. Text overflow.",
          "Multiple format drifts across slides. Some slides text-only.",
          "Mostly consistent. Minor drifts on a few slides.",
          "Consistent formatting. One or two imperfections. Every slide has a visual.",
          "Font, size, and alignment per Evernile spec on every slide. Footer, logo, and page numbers are consistent. Every slide has a visual. File named per convention. No text overflow or overlap.",
        ],
      },
      {
        key: "Design",
        is_manual: true,
        guides: [
          "No visual hierarchy. Crowded or empty slides. Off-brand colours. Charts or icons hard to read.",
          "Weak slide composition. Inconsistent visual system. Brand applied unevenly across the deck.",
          "Acceptable layout and brand use. Charts readable. Some slides still feel template-generic.",
          "Clean hierarchy and consistent Evernile look. Visuals reinforce the investment thesis.",
          "Polished CIM-grade design. Strong hierarchy, whitespace, and brand craft. Every slide feels intentional and presentation-ready.",
        ],
      },
      {
        key: "Timeline & Turnaround (14 days)",
        is_manual: true,
        guides: [
          "Delivered more than 3 days late. Or on time with full rework required. Silent on progress.",
          "Delivered Day 15 to 16 with multiple extensions. Iterations poorly absorbed.",
          "Delivered Day 14 with reviewer chase. Wireframe approval late.",
          "Delivered Day 14 as promised. Iterations absorbed cleanly within 24 hours.",
          "Wireframe approved by Day 3. First draft by Day 10. Final Day 13 with buffer for partner review. Iterations turned within 24 hours. Proactive on data gaps flagged to client.",
        ],
      },
    ],
  },
  {
    name: "Financial Model",
    short_label: "Model",
    sla_days: 7,
    sla_note: "7 working days from data-room access",
    dimensions: [
      {
        key: "Model Architecture & Sheet Hierarchy",
        guides: [
          "Random sheet order. No logical tiers. Sheets named 'Sheet1'.",
          "Some structure but supporting schedules missing.",
          "Correct 6-tier structure. Some sheets missing.",
          "Full sheet hierarchy. Scenario selector working.",
          "Cover / Assumptions / Scenario / Revenue Build / Unit Economics / P&L / BS / CF / PPE / Debt / WC / Depn / Tax / DCF / WACC / Comps / LBO / Football Field / Checks / Sensitivities. Hyperlink navigation from cover. Every sheet descriptively named.",
        ],
      },
      {
        key: "Three-Statement Integration",
        guides: [
          "Balance sheet does not balance. CF not linked to BS. Interest hardcoded.",
          "Balances in history only. Multiple plugs. CF partly linked.",
          "Balances with soft plug. CF and BS partly linked.",
          "Balances every year without plug. CF fully linked to BS.",
          "BS balances every year without plug. CF opening = prior closing every year. Interest = avg balance x rate from debt schedule. Depn from PPE schedule flows to P&L. Accumulated depn <= gross block every year. Closing cash = BS cash every year.",
        ],
      },
      {
        key: "Revenue Build",
        guides: [
          "Top-down growth percentage only. No volume-price split. Sector template not applied.",
          "One segment volume-price split. Assumptions hardcoded inside formulas.",
          "Multiple segments with soft assumption exposure.",
          "Full segment build with assumptions on Assumptions sheet.",
          "Sector-appropriate build (hospitals: bed x occupancy x ARPOB; diagnostics: centre x tests x realization; SaaS: opening ARR + new + expansion - churn; D2C: channel x conversion x AOV; manufacturing: capacity x utilization x realization). Every driver on Assumptions sheet. Monthly for early-stage, annual for mature.",
        ],
      },
      {
        key: "Valuation Methods",
        guides: [
          "Single method or wrong formulas. No WACC build.",
          "DCF with errors. Fewer than 4 comps. Terminal method missing.",
          "DCF correct with single terminal method. 5 to 7 comps.",
          "DCF plus Comps plus Precedent. Both terminal methods. India WACC.",
          "DCF (FCFF and FCFE) with Gordon Growth and Exit Multiple terminal. 8 to 15 trading comps (LTM and NTM). 6 to 12 precedent transactions. LBO with 3 sensitivity grids. Football Field aggregating all methods with midpoint. India WACC (10yr G-Sec, Damodaran ERP 8-10%, beta unlevered and relevered, size premium).",
        ],
      },
      {
        key: "Sensitivity & Scenarios",
        guides: [
          "No sensitivity tables. Single case only.",
          "One-way sensitivity. Two scenarios via manual edits.",
          "Two-way DCF sensitivity. Three scenarios but incomplete cascade.",
          "Full sensitivity tables. Scenario switch cascades cleanly.",
          "DCF sensitivity WACC +/- 200bps x terminal growth +/- 100bps. LBO grids: entry x exit multiple, revenue growth x exit margin, leverage x sweep. Base/Upside/Downside scenarios cascade through entire model with delta drivers named on each scenario.",
        ],
      },
      {
        key: "Checks & Integrity",
        guides: [
          "No check sheet. Multiple circular references.",
          "1 to 2 checks. Circular refs unresolved.",
          "3 to 5 checks working. Occasional errors.",
          "All 7 checks green. No circular references.",
          "All 7 mandatory checks green every year: BS balance, CF-cash tie, debt tie, revenue tie, WC tie, tax rate, accumulated depn. Zero circular references. Conditional formatting flags failures instantly. Sum of segment splits equals total on every reconciliation.",
        ],
      },
      {
        key: "Assumption Transparency",
        guides: [
          "All hardcodes inside formulas. No consolidated Assumptions sheet.",
          "Some assumptions consolidated. Many still buried in formulas.",
          "Most assumptions on Assumptions sheet.",
          "All assumptions on Assumptions sheet with source column.",
          "Every input on Assumptions sheet in blue with driver, unit, value, source, comment, sensitivity range. Single source of truth. Scenario-ready. Zero hardcodes in formulas anywhere in the model.",
        ],
      },
      {
        key: "Colour Coding & Number Formatting",
        guides: [
          "Default Excel. No color coding. Wrong number formats. Years as numbers.",
          "Some color coding. Inconsistent formats. Percentages without decimals.",
          "Blue inputs, black formulas mostly. Some drift on cross-sheet links.",
          "Full color code discipline. Correct number formats.",
          "Blue inputs, black formulas, green cross-sheet links, red external links. FY2025 as text not 2,025. INR #,##0 with USD conversion footnoted. Percentages 0.0%. Negatives in parens. Zeros as '-'. Historical gray fill, projected white. A/P/E/F markers on every column header.",
        ],
      },
      {
        key: "Documentation & Print-Readiness",
        guides: [
          "No cover. No instructions. Sheets unnamed. Not print-ready.",
          "Cover with headline number only. Print settings default.",
          "Cover with KPIs. Sheets named. Print header partial.",
          "Cover with KPIs and valuation summary. Print-ready.",
          "Cover with executive summary, key outputs, valuation summary, sensitivity heatmap, model version and date, scenario cell reference, color code legend. Print header 'Evernile Capital | Client | Confidential' on every sheet. Freeze panes on labels row. Landscape fit-to-width. File under 10MB.",
        ],
      },
      {
        key: "Design",
        is_manual: true,
        guides: [
          "No visual discipline. Unreadable outputs. Charts and cover look unfinished or off-brand.",
          "Weak presentation layer. Inconsistent styling across sheets. Hard for a partner to scan.",
          "Acceptable cover and chart polish. Some sheets still look raw Excel.",
          "Clean cover, charts, and print layout. Consistent Evernile presentation standards.",
          "Board-ready design layer. Cover, charts, and print pack look intentional, branded, and easy to present.",
        ],
      },
      {
        key: "Timeline & Turnaround (7 days)",
        is_manual: true,
        guides: [
          "Delivered more than 2 days late. Or on time with full rework required.",
          "Delivered Day 8 to 9 with multiple extensions. Iterations poorly absorbed.",
          "Delivered Day 7 with reviewer chase. Checks not run before submission.",
          "Delivered Day 7 as promised. Iterations absorbed cleanly within 12 hours.",
          "Draft model by Day 5. Valuation triangulation by Day 6. Final Day 7 with buffer. All 7 checks green before submission. Iterations turned within 12 hours. Proactive on data gaps flagged to client.",
        ],
      },
    ],
  },
];

export const DOC_TYPE_NAMES = DOC_TYPE_RUBRICS.map((d) => d.name);

export function equalWeight(count) {
  if (!count) return 0;
  return Math.round((10000 / count)) / 100;
}

export function gradeFromAverage(avg) {
  if (avg == null) return "Pending";
  if (avg >= 4.5) return "A+";
  if (avg >= 4.0) return "A";
  if (avg >= 3.5) return "B+";
  if (avg >= 3.0) return "B";
  if (avg >= 2.5) return "C";
  return "D";
}
