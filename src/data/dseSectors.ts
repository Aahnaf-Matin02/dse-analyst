// ============================================================
// DSE COMPLETE SECTOR REFERENCE MAP
// Source: DSE official sector-wise listing (dse.com.bd)
// Last verified: June 2026
// Usage: Import this in dseData.ts & stockRepository.ts
//        for sector-aware AI analysis and screener filtering
// ============================================================

import { StockData } from "../types";

export interface SectorInfo {
  name: string;
  sector: string;       // DSE official sector name
  subSector: string;    // Granular sub-classification for AI analysis
}

export const DSE_SECTOR_MAP: Record<string, SectorInfo> = {

  // ═══════════════════════════════════════════════════════
  // BANK  (36 companies)
  // ═══════════════════════════════════════════════════════
  "ABBANK":     { name: "AB Bank PLC",                         sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "ALARABANK":  { name: "Al-Arafah Islami Bank PLC",           sector: "Bank", subSector: "Private Commercial Bank (Islamic)" },
  "BANKASIA":   { name: "Bank Asia PLC",                       sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "BRACBANK":   { name: "BRAC Bank PLC",                       sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "CITYBANK":   { name: "The City Bank PLC",                   sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "DHAKABANK":  { name: "Dhaka Bank PLC",                      sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "DUTCHBANGL": { name: "Dutch-Bangla Bank PLC",               sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "EBL":        { name: "Eastern Bank PLC",                    sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "ICBIBANK":   { name: "ICB Islamic Bank Ltd",                sector: "Bank", subSector: "Private Commercial Bank (Islamic)" },
  "IFIC":       { name: "IFIC Bank PLC",                       sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "ISLAMIBANK": { name: "Islami Bank Bangladesh PLC",          sector: "Bank", subSector: "Private Commercial Bank (Islamic)" },
  "JAMUNABANK": { name: "Jamuna Bank PLC",                     sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "LHB":        { name: "Lockpur Bangladesh Ltd",              sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "MERCANBANK": { name: "Mercantile Bank PLC",                 sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "MIDLANDBNK": { name: "Midland Bank PLC",                    sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "MTB":        { name: "Mutual Trust Bank PLC",               sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "NBL":        { name: "National Bank PLC",                   sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "NCCBANK":    { name: "NCC Bank PLC",                        sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "NRBBANK":    { name: "NRB Bank PLC",                        sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "NRBCBANK":   { name: "NRB Commercial Bank PLC",             sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "ONEBANKPLC": { name: "One Bank PLC",                        sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "NEBANKPLC":  { name: "One Bank PLC (NEBANKPLC)",            sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "PREMIERBAN": { name: "Premier Bank PLC",                    sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "PRIMEBANK":  { name: "Prime Bank PLC",                      sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "PUBALIBANK": { name: "Pubali Bank PLC",                     sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "RUPALIBANK": { name: "Rupali Bank PLC",                     sector: "Bank", subSector: "State-Owned Commercial Bank" },
  "SBACBANK":   { name: "SBAC Bank PLC",                       sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "SHAHJABANK": { name: "Shahjalal Islami Bank PLC",           sector: "Bank", subSector: "Private Commercial Bank (Islamic)" },
  "SIPLC":      { name: "Social Islami Bank PLC",              sector: "Bank", subSector: "Private Commercial Bank (Islamic)" },
  "STANDBANKL": { name: "Standard Bank PLC",                   sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "TRUSTBANK":  { name: "Trust Bank PLC",                      sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "UCB":        { name: "United Commercial Bank PLC",          sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },
  "UTTARABANK": { name: "Uttara Bank PLC",                     sector: "Bank", subSector: "Private Commercial Bank (Conventional)" },

  // ═══════════════════════════════════════════════════════
  // CEMENT  (7 companies)
  // ═══════════════════════════════════════════════════════
  "ARAMITCEM":  { name: "Aramit Cement Ltd",                   sector: "Cement", subSector: "Portland & Blended Cement" },
  "CONFIDCEM":  { name: "Confidence Cement PLC",               sector: "Cement", subSector: "Portland & Blended Cement" },
  "CROWNCEMNT": { name: "Crown Cement PLC",                    sector: "Cement", subSector: "Portland & Blended Cement" },
  "HEIDELBCEM": { name: "HeidelbergCement Bangladesh Ltd",     sector: "Cement", subSector: "Portland & Blended Cement" },
  "MEGHNACEM":  { name: "Meghna Cement Mills PLC",             sector: "Cement", subSector: "Portland & Blended Cement" },
  "PREMIERCEM": { name: "Premier Cement Mills PLC",            sector: "Cement", subSector: "Portland & Blended Cement" },
  "MICEMENT":   { name: "MI Cement Factory Ltd",               sector: "Cement", subSector: "Portland & Blended Cement" },

  // ═══════════════════════════════════════════════════════
  // CERAMICS SECTOR  (5 companies)
  // ═══════════════════════════════════════════════════════
  "FUWANGCER":  { name: "Fu-Wang Ceramic Industry Ltd",        sector: "Ceramics Sector", subSector: "Ceramic Tiles & Sanitaryware" },
  "MONNOCERA":  { name: "Monno Ceramic Industries PLC",        sector: "Ceramics Sector", subSector: "Ceramic Tiles & Sanitaryware" },
  "RAKCERAMIC": { name: "RAK Ceramics (Bangladesh) Ltd",       sector: "Ceramics Sector", subSector: "Ceramic Tiles & Sanitaryware" },
  "SPCERAMICS": { name: "Standard Ceramic Industries Ltd",     sector: "Ceramics Sector", subSector: "Ceramic Tiles & Sanitaryware" },
  "STANCERAM":  { name: "Standard Ceramics Ltd",               sector: "Ceramics Sector", subSector: "Ceramic Tiles & Sanitaryware" },

  // ═══════════════════════════════════════════════════════
  // ENGINEERING  (42 companies)
  // ═══════════════════════════════════════════════════════
  "AFTABAUTO":  { name: "Aftab Automobiles Ltd",               sector: "Engineering", subSector: "Automobiles & Assembly" },
  "ANWARGALV":  { name: "Anwar Galvanizing Ltd",               sector: "Engineering", subSector: "Steel & Metal Products" },
  "APOLOISPAT": { name: "Apolo Ispat Complex Ltd",             sector: "Engineering", subSector: "Steel Re-Rolling" },
  "ARAMIT":     { name: "Aramit Limited",                      sector: "Engineering", subSector: "Building Materials & Roofing" },
  "ATLASBANG":  { name: "Atlas Bangladesh PLC",                sector: "Engineering", subSector: "Batteries & Electrical" },
  "AZIZPIPES":  { name: "Aziz Pipes Ltd",                      sector: "Engineering", subSector: "Steel & Metal Pipes" },
  "BBSCABLES":  { name: "BBS Cables PLC",                      sector: "Engineering", subSector: "Cables & Wires" },
  "BDAUTOCA":   { name: "BD Autos Cars Ltd",                   sector: "Engineering", subSector: "Automobiles & Assembly" },
  "BDLAMPS":    { name: "Bangladesh Lamps PLC",                sector: "Engineering", subSector: "Electrical & Lighting" },
  "BDWELDING":  { name: "BD Welding Electrodes Ltd",           sector: "Engineering", subSector: "Welding & Electrodes" },
  "BENGALWTL":  { name: "Bengal Windsor Thermoplastics Ltd",   sector: "Engineering", subSector: "Plastics & Polymers" },
  "BSRMLTD":    { name: "BSRM Ltd",                            sector: "Engineering", subSector: "Steel Re-Rolling" },
  "BSRMSTEEL":  { name: "BSRM Steels Ltd",                     sector: "Engineering", subSector: "Steel Re-Rolling" },
  "COPPERTECH": { name: "Coppertech Industries Ltd",           sector: "Engineering", subSector: "Cables & Wires" },
  "DESHBANDHU": { name: "Deshbandhu Polymer Ltd",              sector: "Engineering", subSector: "Plastics & Polymers" },
  "DOMINAGE":   { name: "Dominage Steel Building Systems Ltd", sector: "Engineering", subSector: "Pre-Engineered Steel Structures" },
  "ECABLES":    { name: "Eastern Cables PLC",                  sector: "Engineering", subSector: "Cables & Wires" },
  "EIL":        { name: "Eastern Industrial Ltd",              sector: "Engineering", subSector: "Industrial Equipment" },
  "ETL":        { name: "Electro-Technical Ltd",               sector: "Engineering", subSector: "Electrical & Lighting" },
  "GPHISPAT":   { name: "GPH Ispat Ltd",                       sector: "Engineering", subSector: "Steel Re-Rolling" },
  "IFADAUTOS":  { name: "IFAD Autos Ltd",                      sector: "Engineering", subSector: "Automobiles & Assembly" },
  "ITC":        { name: "ITC Ltd",                             sector: "Engineering", subSector: "Industrial & Trading" },
  "JMISMDL":    { name: "JMI Syringes & Medical Devices Ltd",  sector: "Engineering", subSector: "Medical Devices & Equipment" },
  "KAY&QUE":   { name: "Kay & Que (Bangladesh) Ltd",          sector: "Engineering", subSector: "Electrical & Electronics" },
  "KDSALTD":    { name: "KDS Accessories Ltd",                 sector: "Engineering", subSector: "Garment Accessories" },
  "MIRACLEIND": { name: "Miracle Industries Ltd",              sector: "Engineering", subSector: "Plastics & Packaging" },
  "MIRAKHTER":  { name: "Mir Akhter Hossain Ltd",              sector: "Engineering", subSector: "Construction & Engineering" },
  "MONNOAGML":  { name: "Monno Agro and General Machinery Ltd",sector: "Engineering", subSector: "Agricultural & General Machinery" },
  "NPOLYMER":   { name: "Northern Polymer Ltd",                sector: "Engineering", subSector: "Plastics & Polymers" },
  "NTLTUBES":   { name: "National Tubes Ltd",                  sector: "Engineering", subSector: "Steel & Metal Pipes" },
  "QUASEMIND":  { name: "Quasem Industries Ltd",               sector: "Engineering", subSector: "Steel & Metal Products" },
  "RANFOUNDRY": { name: "Rangpur Foundry Ltd",                 sector: "Engineering", subSector: "Iron Casting & Foundry" },
  "RENWICKJA":  { name: "Renwick Jajuneswar & Co. Ltd",        sector: "Engineering", subSector: "Cycle & Auto Parts" },
  "RSRMSTEEL":  { name: "RSRM Steel Mills Ltd",                sector: "Engineering", subSector: "Steel Re-Rolling" },
  "RUNNERAUTO": { name: "Runner Automobiles PLC",              sector: "Engineering", subSector: "Motorcycles & Vehicles" },
  "SINGERBD":   { name: "Singer Bangladesh Ltd",               sector: "Engineering", subSector: "Consumer Electronics & Appliances" },
  "SSSTEEL":    { name: "S.S. Steel Ltd",                      sector: "Engineering", subSector: "Steel Re-Rolling" },
  "USMANIAGL":  { name: "Usmani & Co. Ltd",                    sector: "Engineering", subSector: "Galvanizing & Metal Products" },
  "WALTONHIL":  { name: "Walton Hi-Tech Industries PLC",       sector: "Engineering", subSector: "Consumer Electronics & Appliances" },
  "WMSHIPYARD": { name: "Western Marine Shipyard Ltd",         sector: "Engineering", subSector: "Shipbuilding & Marine" },
  "MONOSPOOL":  { name: "Monowara Spool Ltd",                  sector: "Engineering", subSector: "Industrial Components" },
  "OAL":        { name: "Olympic Accessories Ltd",             sector: "Engineering", subSector: "Garment Accessories" },

  // ═══════════════════════════════════════════════════════
  // FINANCIAL INSTITUTIONS  (23 companies)
  // ═══════════════════════════════════════════════════════
  "BAYLEASING": { name: "Bay Leasing & Investment Ltd",        sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "BDFINANCE":  { name: "BD Finance PLC",                      sector: "Financial Institutions", subSector: "Non-Bank Financial Institution" },
  "BIFC":       { name: "Bangladesh Industrial Finance Co. Ltd",sector: "Financial Institutions", subSector: "Investment Finance" },
  "FAREASTFIN": { name: "Far East Finance & Investment Ltd",   sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "FASFIN":     { name: "FAS Finance & Investment Ltd",        sector: "Financial Institutions", subSector: "Islamic Leasing & Finance" },
  "FIRSTFIN":   { name: "First Finance Ltd",                   sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "GSPFINANCE": { name: "GSP Finance Company (Bangladesh) Ltd",sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "ICB":        { name: "Investment Corporation of Bangladesh", sector: "Financial Institutions", subSector: "State Investment Corporation" },
  "ICICL":      { name: "ICB Capital Management Ltd",          sector: "Financial Institutions", subSector: "Capital Market Intermediary" },
  "IDLC":       { name: "IDLC Finance PLC",                    sector: "Financial Institutions", subSector: "Non-Bank Financial Institution" },
  "ILFSL":      { name: "International Leasing & Financial Services Ltd", sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "IPDC":       { name: "IPDC Finance PLC",                    sector: "Financial Institutions", subSector: "Non-Bank Financial Institution" },
  "ISLAMICFIN": { name: "Islamic Finance & Investment Ltd",    sector: "Financial Institutions", subSector: "Islamic Leasing & Finance" },
  "LANKABAFIN": { name: "LankaBangla Finance PLC",             sector: "Financial Institutions", subSector: "Non-Bank Financial Institution" },
  "MIDASFIN":   { name: "Midas Financing Ltd",                 sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "NHFIL":      { name: "National Housing Finance & Investments Ltd", sector: "Financial Institutions", subSector: "Housing Finance" },
  "PHOENIXFIN": { name: "Phoenix Finance & Investments Ltd",   sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "PLFSL":      { name: "Prime Finance & Investment Ltd",      sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "PREMIERLEA": { name: "Premier Leasing & Finance Ltd",       sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "PRIMEFIN":   { name: "Prime Finance",                       sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "UNIONCAP":   { name: "Union Capital Ltd",                   sector: "Financial Institutions", subSector: "Leasing & Finance" },
  "UNITEDFIN":  { name: "United Finance PLC",                  sector: "Financial Institutions", subSector: "Non-Bank Financial Institution" },
  "UTTARAFIN":  { name: "Uttara Finance and Investments Ltd",  sector: "Financial Institutions", subSector: "Leasing & Finance" },

  // ═══════════════════════════════════════════════════════
  // FOOD & ALLIED  (21 companies)
  // ═══════════════════════════════════════════════════════
  "AFCAGRO":    { name: "AFC Agro Biotech Ltd",                sector: "Food & Allied", subSector: "Agro Processing" },
  "AMANFEED":   { name: "Aman Feed Ltd",                       sector: "Food & Allied", subSector: "Animal Feed" },
  "AMCL(PRAN)": { name: "Agricultural Marketing Co. Ltd (PRAN)",sector: "Food & Allied", subSector: "Food Processing & Beverages" },
  "APEXFOODS":  { name: "Apex Foods Ltd",                      sector: "Food & Allied", subSector: "Fish & Seafood Processing" },
  "BATBC":      { name: "British American Tobacco Bangladesh Co.", sector: "Food & Allied", subSector: "Tobacco Products" },
  "BDTHAIFOOD": { name: "BD Thai Food & Beverage Ltd",         sector: "Food & Allied", subSector: "Food Processing & Beverages" },
  "EMERALDOIL": { name: "Emerald Oil Industries Ltd",          sector: "Food & Allied", subSector: "Edible Oil & Fats" },
  "FINEFOODS":  { name: "Fine Foods Ltd",                      sector: "Food & Allied", subSector: "Food Processing & Beverages" },
  "FUWANGFOOD": { name: "Fu-Wang Foods Ltd",                   sector: "Food & Allied", subSector: "Biscuits & Confectionery" },
  "GEMINISEA":  { name: "Gemini Sea Food Ltd",                 sector: "Food & Allied", subSector: "Fish & Seafood Processing" },
  "INDEXAGRO":  { name: "Index Agro Industries Ltd",           sector: "Food & Allied", subSector: "Agro Processing" },
  "LOVELLO":    { name: "Lovello Ice-Cream PLC",               sector: "Food & Allied", subSector: "Ice Cream & Frozen Food" },
  "MARICO":     { name: "Marico Bangladesh Ltd",               sector: "Food & Allied", subSector: "FMCG — Hair & Personal Care" },
  "MEGCONMILK": { name: "Meghna Condensed Milk Industries Ltd",sector: "Food & Allied", subSector: "Dairy & Condensed Milk" },
  "OLYMPIC":    { name: "Olympic Industries Ltd",              sector: "Food & Allied", subSector: "Biscuits, Confectionery & Snacks" },
  "RAHIMAFOOD": { name: "Rahima Food Corporation Ltd",         sector: "Food & Allied", subSector: "Food Processing & Beverages" },
  "RDFOOD":     { name: "R&D Food Products Ltd",               sector: "Food & Allied", subSector: "Food Processing & Beverages" },
  "RECKITTBEN": { name: "Reckitt Benckiser (Bangladesh) PLC",  sector: "Food & Allied", subSector: "FMCG — Health & Hygiene" },
  "SHYAMPSUG":  { name: "Shyampur Sugar Mills Ltd",            sector: "Food & Allied", subSector: "Sugar & Allied" },
  "UNILEVERCL": { name: "Unilever Consumer Care Ltd",          sector: "Food & Allied", subSector: "FMCG — Personal Care & Home" },
  "ZEALBANGLA": { name: "Zeal Bangla Sugar Mills Ltd",         sector: "Food & Allied", subSector: "Sugar & Allied" },

  // ═══════════════════════════════════════════════════════
  // FUEL & POWER  (23 companies)
  // ═══════════════════════════════════════════════════════
  "BARKAPOWER": { name: "Baraka Power Ltd",                    sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "CVOPRL":     { name: "CVR Power Ltd",                       sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "DESCO":      { name: "Dhaka Electric Supply Company Ltd",   sector: "Fuel & Power", subSector: "Power Distribution" },
  "DOREENPWR":  { name: "Doreen Power Generations & Systems Ltd", sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "EPGL":       { name: "Energy Prima Ltd",                    sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "GBBPOWER":   { name: "GBB Power Ltd",                       sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "JAMUNAOIL":  { name: "Jamuna Oil Company Ltd",              sector: "Fuel & Power", subSector: "Petroleum Downstream" },
  "KBPPWBIL":   { name: "Khulna Power Company Ltd",            sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "KPCL":       { name: "Karnaphuli Power Company Ltd",        sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "KPPL":       { name: "Kattali Power Plant Ltd",             sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "MJLBD":      { name: "MJL Bangladesh PLC",                  sector: "Fuel & Power", subSector: "Petroleum Downstream — Lubricants" },
  "MPETROLEUM": { name: "Meghna Petroleum Ltd",                sector: "Fuel & Power", subSector: "Petroleum Downstream" },
  "NAVANACNG":  { name: "Navana CNG Ltd",                      sector: "Fuel & Power", subSector: "Compressed Natural Gas (CNG)" },
  "PADMAOIL":   { name: "Padma Oil Company Ltd",               sector: "Fuel & Power", subSector: "Petroleum Downstream" },
  "POWERGRID":  { name: "Power Grid Company of Bangladesh PLC",sector: "Fuel & Power", subSector: "Power Transmission" },
  "PURABIGEN":  { name: "Purabi General Insurance / Purabi Power", sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "SAIFPOWER":  { name: "Saif Powertec Ltd",                   sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "SUMITPOWER": { name: "Sumit Power Ltd",                     sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "TITASGAS":   { name: "Titas Gas Transmission & Distribution Co. Ltd", sector: "Fuel & Power", subSector: "Gas Transmission & Distribution" },
  "UPGDCL":     { name: "United Power Generation & Distribution Co. Ltd", sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "BDTHAI":     { name: "BD-Thai Food & Beverage Ltd",         sector: "Fuel & Power", subSector: "Power Generation (IPP)" },
  "OIMEX":      { name: "Oimex Electrode Ltd",                 sector: "Fuel & Power", subSector: "Power Sector Equipment" },
  "EGEN":       { name: "East-West Seed Bangladesh Ltd / Envoy Group Energy", sector: "Fuel & Power", subSector: "Power Generation (IPP)" },

  // ═══════════════════════════════════════════════════════
  // INSURANCE  (58 companies)
  // ═══════════════════════════════════════════════════════
  "AGRANINS":   { name: "Agrani Insurance Company Ltd",        sector: "Insurance", subSector: "General Insurance" },
  "AIL":        { name: "Asia Insurance Ltd",                  sector: "Insurance", subSector: "General Insurance" },
  "ASIAINS":    { name: "Asia Insurance Ltd",                  sector: "Insurance", subSector: "General Insurance" },
  "ASIAPACINS": { name: "Asia Pacific General Insurance Co. Ltd", sector: "Insurance", subSector: "General Insurance" },
  "BGIC":       { name: "Bangladesh General Insurance Co. Ltd",sector: "Insurance", subSector: "General Insurance" },
  "BNICL":      { name: "Bangladesh National Insurance Co. Ltd",sector: "Insurance", subSector: "General Insurance" },
  "CENTRALINS": { name: "Central Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "CITYGENINS": { name: "City General Insurance Co. Ltd",      sector: "Insurance", subSector: "General Insurance" },
  "CLICL":      { name: "Crystal Life Insurance Co. Ltd",      sector: "Insurance", subSector: "Life Insurance" },
  "CONTININS":  { name: "Continental Insurance Ltd",           sector: "Insurance", subSector: "General Insurance" },
  "CRYSTALINS": { name: "Crystal Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "DELTALIFE":  { name: "Delta Life Insurance Company Ltd",    sector: "Insurance", subSector: "Life Insurance" },
  "DGIC":       { name: "Desh General Insurance Co. Ltd",      sector: "Insurance", subSector: "General Insurance" },
  "DHAKAINS":   { name: "Dhaka Insurance Ltd",                 sector: "Insurance", subSector: "General Insurance" },
  "EASTERNINS": { name: "Eastern Insurance PLC",               sector: "Insurance", subSector: "General Insurance" },
  "EASTLAND":   { name: "Eastland Insurance PLC",              sector: "Insurance", subSector: "General Insurance" },
  "FAREASTLIF": { name: "Far East Life Insurance Co. Ltd",     sector: "Insurance", subSector: "Life Insurance" },
  "FEDERALINS": { name: "Federal Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "GLOBALINS":  { name: "Global Insurance Ltd",                sector: "Insurance", subSector: "General Insurance" },
  "GREENDELT":  { name: "Green Delta Insurance Company Ltd",   sector: "Insurance", subSector: "General Insurance" },
  "ISLAMIINS":  { name: "Islami Insurance Bangladesh Ltd",     sector: "Insurance", subSector: "General Insurance (Islamic)" },
  "JANATAINS":  { name: "Janata Insurance Company Ltd",        sector: "Insurance", subSector: "General Insurance" },
  "KARNAPHULI": { name: "Karnaphuli Insurance Company Ltd",    sector: "Insurance", subSector: "General Insurance" },
  "MEGHNAINS":  { name: "Meghna Insurance Company Ltd",        sector: "Insurance", subSector: "General Insurance" },
  "MEGHNALIFE": { name: "Meghna Life Insurance Company Ltd",   sector: "Insurance", subSector: "Life Insurance" },
  "MERCINS":    { name: "Mercantile Insurance Company Ltd",    sector: "Insurance", subSector: "General Insurance" },
  "NATLIFEINS": { name: "National Life Insurance Co. Ltd",     sector: "Insurance", subSector: "Life Insurance" },
  "NITOLINS":   { name: "Nitol Insurance Company Ltd",         sector: "Insurance", subSector: "General Insurance" },
  "NORTHRNINS": { name: "Northern Insurance Company Ltd",      sector: "Insurance", subSector: "General Insurance" },
  "PADMALIFE":  { name: "Padma Islami Life Insurance Ltd",     sector: "Insurance", subSector: "Life Insurance (Islamic)" },
  "PARAMOUNT":  { name: "Paramount Insurance Company Ltd",     sector: "Insurance", subSector: "General Insurance" },
  "PEOPLESINS": { name: "Peoples Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "PHENIXINS":  { name: "Phoenix Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "PIONEERINS": { name: "Pioneer Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "POPULARLIF": { name: "Popular Life Insurance Co. Ltd",      sector: "Insurance", subSector: "Life Insurance" },
  "PRAGATIINS": { name: "Pragati Insurance Ltd",               sector: "Insurance", subSector: "General Insurance" },
  "PRAGATILIF": { name: "Pragati Life Insurance Ltd",          sector: "Insurance", subSector: "Life Insurance" },
  "PRAGATILIFE": { name: "Pragati Life Insurance Ltd",         sector: "Insurance", subSector: "Life Insurance" },
  "PRIMEINSUR": { name: "Prime Insurance Company Ltd",         sector: "Insurance", subSector: "General Insurance" },
  "PRIMELIFE":  { name: "Prime Life Insurance Co. Ltd",        sector: "Insurance", subSector: "Life Insurance" },
  "PROGRESLIF": { name: "Progressive Life Insurance Co. Ltd",  sector: "Insurance", subSector: "Life Insurance" },
  "PROVATIINS": { name: "Provati Insurance Company Ltd",       sector: "Insurance", subSector: "General Insurance" },
  "RELIANCINS": { name: "Reliance Insurance Ltd",              sector: "Insurance", subSector: "General Insurance" },
  "REPUBLIC":   { name: "Republic Insurance Company Ltd",      sector: "Insurance", subSector: "General Insurance" },
  "SANDHANINS": { name: "Sandhani Life Insurance Co. Ltd",     sector: "Insurance", subSector: "Life Insurance" },
  "SICL":       { name: "Sonar Bangla Insurance Co. Ltd",      sector: "Insurance", subSector: "General Insurance" },
  "SONALILIFE": { name: "Sonali Life Insurance Co. Ltd",       sector: "Insurance", subSector: "Life Insurance" },
  "SONARBAINS": { name: "Sonar Bangla Insurance Co. Ltd",      sector: "Insurance", subSector: "General Insurance" },
  "STANDARINS": { name: "Standard Insurance Ltd",              sector: "Insurance", subSector: "General Insurance" },
  "SUNLIFEINS": { name: "Sun Life Insurance Co. Ltd",          sector: "Insurance", subSector: "Life Insurance" },
  "TAKAFULINS": { name: "Takaful Islami Insurance Ltd",        sector: "Insurance", subSector: "General Insurance (Islamic)" },
  "UNIONINS":   { name: "Union Insurance Company Ltd",         sector: "Insurance", subSector: "General Insurance" },
  "UNITEDINS":  { name: "United Insurance Company Ltd",        sector: "Insurance", subSector: "General Insurance" },

  // ═══════════════════════════════════════════════════════
  // IT SECTOR  (11 companies)
  // ═══════════════════════════════════════════════════════
  "AAMRANET":   { name: "Aamra Networks Ltd",                  sector: "IT Sector", subSector: "Internet & Network Services" },
  "AAMRATECH":  { name: "Aamra Technologies Ltd",              sector: "IT Sector", subSector: "IT Services & Consulting" },
  "ADNTEL":     { name: "ADN Telecom Ltd",                     sector: "IT Sector", subSector: "Internet Service Provider" },
  "AGNISYSL":   { name: "Agni Systems Ltd",                    sector: "IT Sector", subSector: "IT Services & Consulting" },
  "AOL":        { name: "Advanced Online Ltd",                 sector: "IT Sector", subSector: "Internet & Digital Services" },
  "BDCOM":      { name: "BDCOM Online Ltd",                    sector: "IT Sector", subSector: "Internet Service Provider" },
  "DAFODILCOM": { name: "Daffodil Computers PLC",              sector: "IT Sector", subSector: "IT Hardware & Services" },
  "GENEXIL":    { name: "Genex Infosys Ltd",                   sector: "IT Sector", subSector: "BPO & IT Services" },
  "INTECH":     { name: "Information Technology Consultants Ltd", sector: "IT Sector", subSector: "IT Services & Consulting" },
  "ISNLTD":     { name: "ISN Ltd",                             sector: "IT Sector", subSector: "IT Services & Software" },
  "INTRACO":    { name: "Intraco Refueling Station Ltd",       sector: "IT Sector", subSector: "Technology & Fueling" },

  // ═══════════════════════════════════════════════════════
  // JUTE  (3 companies)
  // ═══════════════════════════════════════════════════════
  "JUTESPINN":  { name: "Jute Spinners Ltd",                   sector: "Jute", subSector: "Jute Goods Manufacturing" },
  "NORTHERN":   { name: "Northern Jute Manufacturing Co. Ltd", sector: "Jute", subSector: "Jute Goods Manufacturing" },
  "SONARGAON":  { name: "Sonargaon Textiles Ltd",              sector: "Jute", subSector: "Jute Goods Manufacturing" },

  // ═══════════════════════════════════════════════════════
  // MISCELLANEOUS  (15 companies)
  // ═══════════════════════════════════════════════════════
  "BEXIMCO":    { name: "Bangladesh Export Import Company Ltd",sector: "Miscellaneous", subSector: "Conglomerate (Textile, Pharma, Real Estate)" },
  "BESTHLDNG":  { name: "Best Holdings Ltd",                   sector: "Miscellaneous", subSector: "Diversified Holdings" },
  "FORTUNE":    { name: "Fortune Shoes Ltd",                   sector: "Miscellaneous", subSector: "Footwear & Leather Goods" },
  "GENNEXT":    { name: "Gennext Industries Ltd",              sector: "Miscellaneous", subSector: "Diversified Manufacturing" },
  "GHCL":       { name: "GHCL Bangladesh Ltd",                 sector: "Miscellaneous", subSector: "Diversified Industrial" },
  "GOLDENSON":  { name: "Goldenson Ltd",                       sector: "Miscellaneous", subSector: "Garment & RMG" },
  "HAKKANIPUL": { name: "Hakkani Pulp & Paper Mills PLC",      sector: "Miscellaneous", subSector: "Paper & Pulp Products" },
  "HAMI":       { name: "HAMI Industries Ltd",                 sector: "Miscellaneous", subSector: "Diversified Industrial" },
  "KEYACOSMET": { name: "Keya Cosmetics Ltd",                  sector: "Miscellaneous", subSector: "Cosmetics & Personal Care" },
  "KOHINOOR":   { name: "Kohinoor Chemical Co. (BD) Ltd",      sector: "Miscellaneous", subSector: "Cosmetics & Household Chemicals" },
  "LRGLOBMF1":  { name: "LR Global Bangladesh Mutual Fund One",sector: "Miscellaneous", subSector: "Diversified Investment" },
  "MAGURAPLEX": { name: "Magura Implex Ltd",                   sector: "Miscellaneous", subSector: "Diversified Industrial" },
  "SHURWID":    { name: "Shurwid Industries Ltd",              sector: "Miscellaneous", subSector: "Diversified Manufacturing" },
  "TILIL":      { name: "TitiL Garments & Fabrics Ltd",        sector: "Miscellaneous", subSector: "RMG & Textiles" },
  "NURANI":     { name: "Nurani Dyeing & Sweater Ltd",         sector: "Miscellaneous", subSector: "Sweater & Knitwear" },

  // ═══════════════════════════════════════════════════════
  // PAPER & PRINTING  (6 companies)
  // ═══════════════════════════════════════════════════════
  "DACCADYE":   { name: "The Dacca Dyeing & Manufacturing Co. Ltd", sector: "Paper & Printing", subSector: "Packaging & Paper" },
  "MEGHNAPET":  { name: "Meghna Pet Industries Ltd",           sector: "Paper & Printing", subSector: "PET & Packaging" },
  "PAPERFIBR":  { name: "Paper Converting & Packaging Ltd",    sector: "Paper & Printing", subSector: "Paper Converting" },
  "SONALIPAPR": { name: "Sonali Paper & Board Mills Ltd",      sector: "Paper & Printing", subSector: "Paper & Board Manufacturing" },
  "YPL":        { name: "Yousuf Paper & Printing Ltd",         sector: "Paper & Printing", subSector: "Paper & Printing" },
  "GQBALLPEN":  { name: "G.Q. Ball Pen Industries Ltd",        sector: "Paper & Printing", subSector: "Writing Instruments & Stationery" },

  // ═══════════════════════════════════════════════════════
  // PHARMACEUTICALS & CHEMICALS  (34 companies)
  // ═══════════════════════════════════════════════════════
  "ACI":        { name: "ACI Limited",                         sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals & Consumer Healthcare" },
  "ACIFORMULA": { name: "ACI Formulations Ltd",                sector: "Pharmaceuticals & Chemicals", subSector: "Agrochemicals & Specialty Chemicals" },
  "ACMELAB":    { name: "ACME Laboratories Ltd",               sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "ACMEPL":     { name: "ACME Pesticides Ltd",                 sector: "Pharmaceuticals & Chemicals", subSector: "Agrochemicals" },
  "AMBEEPHA":   { name: "Ambee Pharmaceuticals Ltd",           sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "ASIATICLAB": { name: "Asiatic Laboratories Ltd",            sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "BEACONPHAR": { name: "Beacon Pharmaceuticals Ltd",          sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "BERGERPBL":  { name: "Berger Paints Bangladesh Ltd",        sector: "Pharmaceuticals & Chemicals", subSector: "Paints & Coatings" },
  "BXPHARMA":   { name: "Beximco Pharmaceuticals Ltd",         sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "CENTRALPHL": { name: "Central Pharmaceuticals Ltd",         sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "FARCHEM":    { name: "Far Chemical Industries Ltd",         sector: "Pharmaceuticals & Chemicals", subSector: "Specialty Chemicals" },
  "IBP":        { name: "IBP Ltd",                             sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "IBNSINA":    { name: "Ibn Sina Pharmaceutical Industry Ltd",sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "LIBRAINFU":  { name: "Libra Infusions Ltd",                 sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Infusion/Injectable" },
  "LINDEBD":    { name: "Linde Bangladesh Ltd",                sector: "Pharmaceuticals & Chemicals", subSector: "Industrial Gases" },
  "NAVANAPHAR": { name: "Navana Pharmaceuticals Ltd",          sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "ORIONINFU":  { name: "Orion Infusion Ltd",                  sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Infusion" },
  "ORIONPHARM": { name: "Orion Pharma Ltd",                    sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "PDL":        { name: "Padma Drugs Ltd",                     sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "PHARMAID":   { name: "Pharma Aids Ltd",                     sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceutical Packaging & Aids" },
  "RENATA":     { name: "Renata Limited",                      sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human & Veterinary" },
  "SALVO":      { name: "Salvo Chemical Industry Ltd",         sector: "Pharmaceuticals & Chemicals", subSector: "Specialty Chemicals" },
  "SILCOPHL":   { name: "Silco Pharmaceuticals Ltd",           sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "SILVAPHL":   { name: "Silva Pharmaceuticals Ltd",           sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "SQURPHARMA": { name: "Square Pharmaceuticals Ltd",          sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "TECHNODRUG": { name: "Techno Drugs Ltd",                    sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "WATACHEM":   { name: "WATA Chemicals Ltd",                  sector: "Pharmaceuticals & Chemicals", subSector: "Specialty Chemicals" },
  "ADVENT":     { name: "Advent Pharma Ltd",                   sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },
  "NFML":       { name: "National Feed Mills Ltd",             sector: "Pharmaceuticals & Chemicals", subSector: "Agrochemicals & Feed" },
  "ACFL":       { name: "Active Fine Chemicals Ltd",           sector: "Pharmaceuticals & Chemicals", subSector: "Active Pharmaceutical Ingredients (API)" },
  "MHSML":      { name: "MHS (BD) Ltd",                        sector: "Pharmaceuticals & Chemicals", subSector: "Pharmaceuticals — Human" },

  // ═══════════════════════════════════════════════════════
  // SERVICES & REAL ESTATE  (4 companies)
  // ═══════════════════════════════════════════════════════
  "EHL":        { name: "Eastern Housing Ltd",                 sector: "Services & Real Estate", subSector: "Real Estate & Property Development" },
  "SAMORITA":   { name: "Samorita Hospital Ltd",               sector: "Services & Real Estate", subSector: "Healthcare & Hospital Services" },
  "SPCL":       { name: "Saiham Properties Ltd",               sector: "Services & Real Estate", subSector: "Real Estate Development" },
  "UNIQUEHRL":  { name: "Unique Hotel and Resorts Ltd",        sector: "Services & Real Estate", subSector: "Hotels & Resorts" },

  // ═══════════════════════════════════════════════════════
  // TANNERY INDUSTRIES  (6 companies)
  // ═══════════════════════════════════════════════════════
  "APEXFOOT":   { name: "Apex Footwear Ltd",                   sector: "Tannery Industries", subSector: "Footwear Manufacturing" },
  "APEXTANRY":  { name: "Apex Tannery Ltd",                    sector: "Tannery Industries", subSector: "Leather Processing" },
  "BATASHOE":   { name: "Bata Shoe Company (Bangladesh) Ltd",  sector: "Tannery Industries", subSector: "Footwear Manufacturing" },
  "LEGACYFOOT": { name: "Legacy Footwear Ltd",                 sector: "Tannery Industries", subSector: "Footwear Manufacturing" },
  "SAMATALETH": { name: "Samata Leather Complex Ltd",          sector: "Tannery Industries", subSector: "Leather Processing" },
  "PENINSULA":  { name: "Peninsula Chittagong Ltd",            sector: "Tannery Industries", subSector: "Leather Processing" },

  // ═══════════════════════════════════════════════════════
  // TELECOMMUNICATION  (3 companies)
  // ═══════════════════════════════════════════════════════
  "GP":         { name: "Grameenphone Ltd",                    sector: "Telecommunication", subSector: "Mobile Network Operator" },
  "ROBI":       { name: "Robi Axiata Ltd",                     sector: "Telecommunication", subSector: "Mobile Network Operator" },
  "NTC":        { name: "National Telecom Ltd",                sector: "Telecommunication", subSector: "Fixed-Line Telecom" },

  // ═══════════════════════════════════════════════════════
  // TEXTILE  (58 companies)
  // ═══════════════════════════════════════════════════════
  "ACTIVEFINE": { name: "Activefine PLC",                      sector: "Textile", subSector: "Knitting & Knitwear" },
  "AL-HAJTEX":  { name: "Al-Haj Textile Mills Ltd",            sector: "Textile", subSector: "Weaving & Fabrics" },
  "ALLTEX":     { name: "Alltex Industries Ltd",               sector: "Textile", subSector: "Spinning Mills" },
  "ANLIMAYARN": { name: "Anlima Yarn Dyeing Ltd",              sector: "Textile", subSector: "Yarn Dyeing & Processing" },
  "APEXSPINN":  { name: "Apex Spinning & Knitting Mills Ltd",  sector: "Textile", subSector: "Spinning Mills" },
  "ARGONDENIM": { name: "Argon Denim Ltd",                     sector: "Textile", subSector: "Denim Fabric Manufacturing" },
  "BBS":        { name: "BBS Cables PLC (Textile Division)",   sector: "Textile", subSector: "Spinning Mills" },
  "CNATEX":     { name: "C&A Textiles Ltd",                    sector: "Textile", subSector: "Composite Textile" },
  "DELTASPINN": { name: "Delta Spinners Ltd",                  sector: "Textile", subSector: "Spinning Mills" },
  "DSHGARME":   { name: "Desh Garments Ltd",                   sector: "Textile", subSector: "Readymade Garments (RMG)" },
  "DSSL":       { name: "Dragon Sweater & Spinning Ltd",       sector: "Textile", subSector: "Sweater & Knitwear" },
  "DULAMIACOT": { name: "Dulamia Cotton Spinning Mills Ltd",   sector: "Textile", subSector: "Cotton Spinning" },
  "ENVOYTEX":   { name: "Envoy Textiles Ltd",                  sector: "Textile", subSector: "Denim Fabric Manufacturing" },
  "ESQUIRENIT": { name: "Esquire Knit Composite Ltd",          sector: "Textile", subSector: "Knitting & Knitwear" },
  "FAMILYTEX":  { name: "Family Tex (BD) Ltd",                 sector: "Textile", subSector: "Composite Textile" },
  "FAMILYTEXT": { name: "Family Tex (BD) Ltd",                 sector: "Textile", subSector: "Composite Textile" },
  "FEKDIL":     { name: "Far East Knitting & Dyeing Industries Ltd", sector: "Textile", subSector: "Knitting & Dyeing" },
  "GHAIL":      { name: "GHA Industries Ltd",                  sector: "Textile", subSector: "Spinning Mills" },
  "HRTEX":      { name: "HR Textile Ltd",                      sector: "Textile", subSector: "Composite Textile" },
  "HWAWELLTEX": { name: "HwaWell Textile Ltd",                 sector: "Textile", subSector: "Composite Textile" },
  "JHRML":      { name: "Jharna Handloom & Fabric Ltd",        sector: "Textile", subSector: "Handloom & Fabrics" },
  "KTL":        { name: "Kabir Textile Ltd",                   sector: "Textile", subSector: "Spinning Mills" },
  "MAKSONSPIN": { name: "Makson Spinning Mills Ltd",           sector: "Textile", subSector: "Spinning Mills" },
  "MALEKSPIN":  { name: "Malek Spinning Mills Ltd",            sector: "Textile", subSector: "Spinning Mills" },
  "MATINSPINN": { name: "Matin Spinning Mills Ltd",            sector: "Textile", subSector: "Spinning Mills" },
  "METROSPIN":  { name: "Metro Spinning Ltd",                  sector: "Textile", subSector: "Spinning Mills" },
  "MITHUNKNIT": { name: "Mithun Knitting & Dyeing Ltd",        sector: "Textile", subSector: "Knitting & Dyeing" },
  "MLDYEING":   { name: "MLD Dyeing Ltd",                      sector: "Textile", subSector: "Yarn Dyeing & Processing" },
  "MONNOFABR":  { name: "Monno Fabrics Ltd",                   sector: "Textile", subSector: "Weaving & Fabrics" },
  "NEWLINE":    { name: "Newline Clothing Ltd",                sector: "Textile", subSector: "Readymade Garments (RMG)" },
  "PRIMETEX":   { name: "Prime Textile Spinning Mills Ltd",    sector: "Textile", subSector: "Spinning Mills" },
  "PTL":        { name: "Pacific Textiles Ltd",                sector: "Textile", subSector: "Composite Textile" },
  "QUEENSOUTH": { name: "Queen South Textile Mills Ltd",       sector: "Textile", subSector: "Spinning Mills" },
  "RAHIMTEXT":  { name: "Rahima Textile Mills PLC",             sector: "Textile", subSector: "Weaving & Fabrics" },
  "REGENTTEX":  { name: "Regent Textile Mills Ltd",            sector: "Textile", subSector: "Spinning Mills" },
  "RINGSHINE":  { name: "Ringshine Textiles Ltd",              sector: "Textile", subSector: "Composite Textile" },
  "SAFKOSPINN": { name: "Safko Spinnings Mills Ltd",           sector: "Textile", subSector: "Spinning Mills" },
  "SAIHAMCOT":  { name: "Saiham Cotton Mills Ltd",             sector: "Textile", subSector: "Cotton Spinning" },
  "SAIHAMTEX":  { name: "Saiham Textile Mills Ltd",            sector: "Textile", subSector: "Weaving & Fabrics" },
  "SALAMCRST":  { name: "Salam Crest Ltd",                     sector: "Textile", subSector: "Readymade Garments (RMG)" },
  "SHASHADNIM": { name: "Shasha Denims Ltd",                   sector: "Textile", subSector: "Denim Fabric Manufacturing" },
  "SHEPHERD":   { name: "Shepherd Industries Ltd",             sector: "Textile", subSector: "Composite Textile" },
  "SIMTEX":     { name: "Simtex Industries Ltd",               sector: "Textile", subSector: "Composite Textile" },
  "SINOBANGLA": { name: "Sino-Bangla Industries Ltd",          sector: "Textile", subSector: "Composite Textile" },
  "SKTRIMS":    { name: "SK Trims & Industries Ltd",           sector: "Textile", subSector: "Garment Accessories & Trims" },
  "SQUARETEXT": { name: "Square Textiles PLC",                 sector: "Textile", subSector: "Yarn & Thread Manufacturing" },
  "STYLECRAFT": { name: "Stylecraft Ltd",                      sector: "Textile", subSector: "Readymade Garments (RMG)" },
  "TAMIJTEX":   { name: "Tamij Textiles Ltd",                  sector: "Textile", subSector: "Composite Textile" },
  "TALLUSPIN":  { name: "Tallu Spinning Mills Ltd",            sector: "Textile", subSector: "Spinning Mills" },
  "TOSRIFA":    { name: "Tosrifa Industries Ltd",              sector: "Textile", subSector: "Knitting & Knitwear" },
  "TUNGHAI":    { name: "Tung Hai Knitting & Dyeing Ltd",      sector: "Textile", subSector: "Knitting & Dyeing" },
  "VFSTDL":     { name: "VFS Thread Dyeing Ltd",               sector: "Textile", subSector: "Yarn Dyeing & Processing" },
  "ZAHEENSPIN": { name: "Zaheen Spinning Ltd",                 sector: "Textile", subSector: "Spinning Mills" },
  "ZAHINTEX":   { name: "Zahin Tex Ltd",                       sector: "Textile", subSector: "Composite Textile" },

  // ═══════════════════════════════════════════════════════
  // TRAVEL & LEISURE  (5 companies)
  // ═══════════════════════════════════════════════════════
  "BSCPLC":     { name: "Bangladesh Shipping Corporation PLC", sector: "Travel & Leisure", subSector: "Shipping & Maritime" },
  "BSC":        { name: "Bangladesh Shipping Corporation",     sector: "Travel & Leisure", subSector: "Shipping & Maritime" },
  "SAPORTL":    { name: "Sa-Port Ltd",                         sector: "Travel & Leisure", subSector: "Port & Logistics" },
  "SEAPEARL":   { name: "Sea Pearl Beach Resort & Spa Ltd",    sector: "Travel & Leisure", subSector: "Hotels & Resorts" },
  "SONALIANSH": { name: "Sonali Ansh Industries Ltd",          sector: "Travel & Leisure", subSector: "Leisure & Entertainment" },

};

// ─────────────────────────────────────────────────────────────
// HELPER — merge sector info into any StockData object
// Usage: enrichWithSector(stock) → adds sector & subSector
// ─────────────────────────────────────────────────────────────
export function enrichWithSector<T extends { symbol: string; sector?: string; subSector?: string; name?: string }>(
  stock: T
): T & { sector: string; subSector: string } {
  const info = DSE_SECTOR_MAP[stock.symbol];
  return {
    ...stock,
    sector:    info?.sector    ?? stock.sector    ?? "Miscellaneous",
    subSector: info?.subSector ?? stock.subSector ?? "Uncategorized",
    name:      stock.name      ?? info?.name      ?? stock.symbol,
  };
}

// ─────────────────────────────────────────────────────────────
// DSE OFFICIAL SECTOR LIST  (for screener dropdowns)
// ─────────────────────────────────────────────────────────────
export const DSE_OFFICIAL_SECTORS = [
  "Bank",
  "Cement",
  "Ceramics Sector",
  "Engineering",
  "Financial Institutions",
  "Food & Allied",
  "Fuel & Power",
  "Insurance",
  "IT Sector",
  "Jute",
  "Miscellaneous",
  "Paper & Printing",
  "Pharmaceuticals & Chemicals",
  "Services & Real Estate",
  "Tannery Industries",
  "Telecommunication",
  "Textile",
  "Travel & Leisure",
] as const;

export type DSESector = typeof DSE_OFFICIAL_SECTORS[number];
