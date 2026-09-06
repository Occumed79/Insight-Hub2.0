export type YellowBookSourceAsset = {
  type: "table" | "map" | "figure" | "box";
  id: string;
  page: number;
  title: string;
  excerpt: string;
};

export const YELLOW_BOOK_SOURCE_ASSETS: Record<string, YellowBookSourceAsset[]> = {
  "Zika": [
    {"type":"table","id":"4.22.1","page":6,"title":"Table 4.22.1: Time frames for preventing sexual transmission of Zika virus","excerpt":"Male: at least 3 months. Female: at least 2 months. Methods include condoms or abstinence. Time frames are measured from departure from a location with Zika risk, symptom onset, or diagnosis."}
  ],
  "Yellow Fever": [
    {"type":"table","id":"4.21.1","page":11,"title":"Table 4.21.1: Countries with risk for yellow fever virus transmission","excerpt":"Country/area risk list for Africa and the Americas, including partial-country risk annotations. Intended as geographic transmission-risk context, not a substitute for current destination guidance."},
    {"type":"table","id":"4.21.2","page":12,"title":"Table 4.21.2: Countries with low potential for exposure to yellow fever virus","excerpt":"Low-potential exposure list including Eritrea, São Tomé and Príncipe, Tanzania, Rwanda, Somalia, and Zambia, with notes that some classifications apply only to parts of countries."},
    {"type":"table","id":"4.21.3","page":14,"title":"Table 4.21.3: Vaccine to prevent yellow fever","excerpt":"YF-VAX (17D): age ≥9 months, 0.5 mL subcutaneous, one dose; booster not recommended for most people. Ages 6–8 months and ≥60 years are precautions; age <6 months is a contraindication."},
    {"type":"box","id":"4.21.1","page":15,"title":"Box 4.21.1: Yellow fever vaccine contraindications and precautions","excerpt":"Contraindications include age <6 months, severe vaccine-component allergy, symptomatic/severely immunosuppressed HIV, primary immunodeficiency, immunosuppressive therapy, malignancy, thymus disorder with abnormal immune function, transplantation. Precautions include age 6–8 months, age ≥60, breastfeeding, moderate HIV immunosuppression, and pregnancy."},
    {"type":"table","id":"4.21.4","page":22,"title":"Table 4.21.4: Countries requiring proof of yellow fever vaccination from all arriving travelers","excerpt":"Country entry-requirement list. The chapter explicitly distinguishes legal entry requirements from CDC clinical vaccination recommendations and notes that requirements can change."},
    {"type":"figure","id":"4.21.1","page":25,"title":"Figure 4.21.1: International Certificate of Vaccination or Prophylaxis (ICVP) completion","excerpt":"Worked ICVP example showing traveler identity, vaccine, administration date, clinician signature/status, manufacturer/batch, certificate-valid date, and official administering-center stamp. Primary YF vaccination becomes valid after 10 days and the completed certificate is valid for life."},
    {"type":"figure","id":"4.21.2","page":27,"title":"Figure 4.21.2: ICVP medical contraindication to vaccination","excerpt":"Example medical-contraindication section used for a traveler who cannot receive a required vaccine. The chapter also describes the accompanying signed waiver letter and warns that destination authorities may not accept a waiver."},
    {"type":"map","id":"4.21.1","page":29,"title":"Map 4.21.1: Yellow fever vaccine recommendations for Africa","excerpt":"CDC map distinguishes vaccination recommended, generally not recommended, and not recommended areas, including partial-country recommendations. Current as of December 2024 in the supplied booklet."},
    {"type":"map","id":"4.21.2","page":31,"title":"Map 4.21.2: Yellow fever vaccine recommendations for the Americas","excerpt":"CDC map distinguishes vaccination recommended, generally not recommended, and not recommended areas, including subnational exceptions and major cities. Current as of December 2024 in the supplied booklet."}
  ],
  "Measles (Rubeola)": [
    {"type":"box","id":"4.11.1","page":38,"title":"Box 4.11.1: Measles vaccination recommendations for international travelers based on age","excerpt":"Infants 6–11 months: one early MMR dose, then revaccinate after the first birthday. Children ≥12 months: two doses separated by ≥28 days (MMRV interval ≥3 months). Adults born in/after 1957: two MMR doses separated by ≥28 days."}
  ],
  "Meningococcal Disease": [
    {"type":"map","id":"4.12.1","page":46,"title":"Map 4.12.1: The meningitis belt and other areas at risk for meningococcal meningitis epidemics","excerpt":"Maps the core African meningitis belt and surrounding countries with potential outbreak risk. The chapter notes greatest epidemic risk during the dry season, roughly December–June."},
    {"type":"table","id":"4.12.1","page":48,"title":"Table 4.12.1: Meningococcal vaccines for hyperendemic/epidemic travel","excerpt":"Age-, product-, dose-, and series-specific MenACWY/MenABCWY information for travelers or residents of hyperendemic/epidemic areas, with booster guidance for people at continued risk."}
  ],
  "Norovirus": [],
  "Poliomyelitis": [
    {"type":"table","id":"4.14.1","page":67,"title":"Table 4.14.1: Alternative adult polio vaccine dosing schedules","excerpt":"If travel is <4 weeks away: one IPV dose. If 4–8 weeks: two doses 4 weeks apart. If >8 weeks: three doses using accelerated spacing, with remaining doses completed later when feasible."}
  ],
  "Rabies": [
    {"type":"box","id":"4.15.1","page":73,"title":"Box 4.15.1: Rabies exposure / prevention decision support","excerpt":"Source decision aid covering animal-exposure risk and the need for prevention planning before travel."},
    {"type":"box","id":"4.15.2","page":78,"title":"Box 4.15.2: Clinical rabies recognition","excerpt":"Clinical decision support for recognizing rabies after a compatible exposure; symptoms are a late finding and post-exposure management should not wait for symptoms."},
    {"type":"table","id":"4.15.1","page":80,"title":"Table 4.15.1: Rabies pre-exposure prophylaxis recommendations","excerpt":"Risk-category framework for determining who should receive pre-exposure rabies vaccination and how ongoing exposure affects titer/booster follow-up."},
    {"type":"table","id":"4.15.2","page":82,"title":"Table 4.15.2: Pre-exposure immunization for rabies","excerpt":"Rabies pre-exposure vaccine schedule and administration details for travelers at elevated animal-exposure risk."},
    {"type":"table","id":"4.15.3","page":85,"title":"Table 4.15.3: Post-exposure prophylaxis for rabies","excerpt":"PEP regimen differs by prior vaccination status and immune status; wound cleansing is immediate, and rabies immune globulin is part of management for appropriate previously unvaccinated exposures."}
  ],
  "Rickettsial Diseases": [
    {"type":"table","id":"4.16.1","page":92,"title":"Table 4.16.1: Rickettsial disease classification, vector, and host associations","excerpt":"Links major rickettsial syndromes/pathogens with their primary arthropod vectors and host associations, supporting exposure-specific differential diagnosis."}
  ],
  "Schistosomiasis": [],
  "Tick-Borne Encephalitis": [
    {"type":"table","id":"4.18.1","page":112,"title":"Table 4.18.1: Country-specific TBE risk information","excerpt":"Country- and often subnational-area-specific risk information across Europe and Asia. The text cautions that risk is focal and can vary substantially within a country."},
    {"type":"box","id":"4.18.1","page":118,"title":"Box 4.18.1: TBE travel-risk factors","excerpt":"Risk assessment considers forest-edge exposure, hiking/camping/cycling/hunting and other outdoor activities, occupational exposure including military training, unpasteurized dairy, April–November season, duration, age, and immune status."},
    {"type":"box","id":"4.18.2","page":120,"title":"Box 4.18.2: TBE vaccine decision support","excerpt":"Travel-risk factors and expected exposure are weighed to determine whether TBE vaccination is recommended or may be considered."},
    {"type":"figure","id":"4.18.1","page":121,"title":"Figure 4.18.1: Decision-making for TBE vaccination for U.S. travelers","excerpt":"Decision tree: all travelers with potential tick exposure use bite precautions; vaccination is recommended for extensive exposure and can be considered for lesser exposure based on itinerary, activities, age/outcome risk, and risk tolerance."},
    {"type":"table","id":"4.18.2","page":122,"title":"Table 4.18.2: TICOVAC TBE vaccine administration schedule","excerpt":"Age-specific dose volume, primary-series timing, and booster schedule for TICOVAC."}
  ],
  "Tuberculosis": [
    {"type":"map","id":"4.19.1","page":129,"title":"Map 4.19.1: Estimated tuberculosis incidence rates per 100,000 population, 2022","excerpt":"Global country-level TB incidence map supporting identification of higher-prevalence destinations; exposure still depends heavily on setting, duration, and close contact."},
    {"type":"table","id":"4.19.1","page":132,"title":"Table 4.19.1: Estimated proportion of multidrug- or rifampin-resistant TB","excerpt":"Country-level MDR/RR-TB proportion context for higher-risk destinations, relevant to occupational and prolonged healthcare/humanitarian exposure."}
  ],
  "Typhoid and Paratyphoid Fever": [
    {"type":"map","id":"4.20.1","page":141,"title":"Map 4.20.1: Typhoid vaccine recommendations","excerpt":"Geographic travel-vaccine recommendation map, with highest relevance in South Asia and other endemic low- and middle-income settings."},
    {"type":"table","id":"4.20.1","page":143,"title":"Table 4.20.1: Typhoid fever vaccines licensed in the United States","excerpt":"Product, age, dose, route, schedule, timing before travel, and booster information for U.S.-licensed typhoid vaccines."}
  ],
  "Hepatitis A": [
    {"type":"map","id":"4.5.1","page":151,"title":"Map 4.5.1: Estimated age at midpoint of population immunity to hepatitis A, by country","excerpt":"Global endemicity/immunity context showing major geographic differences in HAV exposure patterns."},
    {"type":"table","id":"4.5.1","page":154,"title":"Table 4.5.1: Vaccines used to prevent hepatitis A virus infection","excerpt":"Hepatitis A vaccine products, age indications, dose/route, schedule, and combination-vaccine information used for pre-travel planning."}
  ],
  "Influenza": [
    {"type":"box","id":"4.6.1","page":163,"title":"Box 4.6.1: Influenza travel considerations","excerpt":"Travel-specific prevention and clinical considerations, including exposure to seasonal circulation outside the traveler’s home-season pattern."},
    {"type":"map","id":"4.6.1","page":166,"title":"Map 4.6.1: Global distribution of highly pathogenic avian influenza A(H5Nx) virus","excerpt":"Global avian-influenza activity context relevant to travelers with poultry, bird, agricultural, or animal-market exposure."},
    {"type":"table","id":"4.6.1","page":169,"title":"Table 4.6.1: Treatment and prophylaxis for influenza A and B","excerpt":"Antiviral treatment and prophylaxis agents with age, dose, duration, and use considerations."}
  ],
  "Japanese Encephalitis": [
    {"type":"table","id":"4.7.1","page":180,"title":"Table 4.7.1: Risk areas and transmission season for Japanese encephalitis, by destination","excerpt":"Destination-level and often subnational JE risk areas, transmission seasons, and comments. The chapter stresses that risk changes by location, year, itinerary, season, outdoor exposure, and accommodations."},
    {"type":"table","id":"4.7.2","page":184,"title":"Table 4.7.2: IXIARO Japanese encephalitis vaccine administration","excerpt":"Age-specific dose volume, primary-series schedule, accelerated adult timing where applicable, and booster information."}
  ],
  "Leishmaniasis": [],
  "Leptospirosis": [],
  "Malaria": [
    {"type":"box","id":"4.10.1","page":208,"title":"Box 4.10.1: Frequently asked malaria clinical questions","excerpt":"Operational fever guidance: malaria after endemic-area travel is urgent; testing should be available within hours, not sent to slow reference labs. If severe malaria is suspected and immediate testing is unavailable, treatment may need to begin before confirmation."},
    {"type":"table","id":"4.10.1","page":212,"title":"Table 4.10.1: Reliable supply regimens for malaria treatment","excerpt":"Standby/reliable-supply treatment regimens for selected travelers when access to prompt medical care is uncertain; this is not routine self-treatment and does not replace chemoprophylaxis."},
    {"type":"table","id":"4.10.2","page":214,"title":"Table 4.10.2: Malaria chemoprophylaxis prescribing considerations","excerpt":"Compares prophylaxis options by reasons to consider or avoid them, including pregnancy, renal disease, neuropsychiatric history, trip length, cost, and start/stop timing."},
    {"type":"table","id":"4.10.3","page":218,"title":"Table 4.10.3: Malaria chemoprophylaxis dosing information","excerpt":"Drug-, age/weight-, timing-, and duration-specific prophylaxis dosing. Includes G6PD-related restrictions for primaquine/tafenoquine and differing post-travel continuation periods."},
    {"type":"table","id":"4.10.4","page":224,"title":"Table 4.10.4: Half-lives of medications used for malaria prophylaxis","excerpt":"Drug half-life context useful for understanding missed doses, side effects, and medication-switch planning."},
    {"type":"table","id":"4.10.5","page":225,"title":"Table 4.10.5: Changing malaria chemoprophylaxis because of side effects","excerpt":"How to transition safely among malaria prophylaxis medications when adverse effects require a regimen change."},
    {"type":"box","id":"4.10.2","page":228,"title":"Box 4.10.2: Malaria prevention / special operational considerations","excerpt":"Additional clinical and operational guidance that complements itinerary-specific prophylaxis selection and mosquito-bite prevention."},
    {"type":"table","id":"4.10.6","page":232,"title":"Table 4.10.6: FDA recommendations for deferring blood donation after malaria exposure","excerpt":"Blood-donation deferral timing after malaria travel/infection, relevant to post-deployment counseling and blood-safety screening."}
  ],
  "Chikungunya": [
    {"type":"table","id":"4.1.1","page":240,"title":"Table 4.1.1: Chikungunya vaccine contraindications and precautions","excerpt":"Source-specific contraindications/precautions for chikungunya vaccination; vaccine use is destination-, outbreak-, age-, and exposure-dependent."}
  ],
  "Cholera": [],
  "COVID-19": [
    {"type":"table","id":"4.3.1","page":255,"title":"Table 4.3.1: COVID-19 treatments","excerpt":"Treatment options and patient-selection/timing considerations for travelers who develop COVID-19."},
    {"type":"box","id":"4.3.1","page":257,"title":"Box 4.3.1: COVID-19 travel contingency / prevention considerations","excerpt":"Operational planning for illness while abroad, including prevention, testing, treatment access, and contingency planning."}
  ],
  "Dengue": [
    {"type":"map","id":"4.4.1","page":262,"title":"Map 4.4.1: Global dengue risk classification","excerpt":"Global and subnational classification into Frequent/Continuous Risk, Sporadic/Uncertain Risk, and No Evidence of Risk. Frequent/continuous is based on >10 cases in at least 3 of the previous 10 years; sporadic/uncertain is at least one locally acquired case in the last 10 years."},
    {"type":"figure","id":"4.4.1","page":269,"title":"Figure 4.4.1: Dengue clinical classification","excerpt":"Distinguishes dengue without warning signs, dengue with warning signs, and severe dengue, with laboratory-confirmation context. Warning signs/severe disease require close observation and inpatient management."},
    {"type":"figure","id":"4.4.2","page":271,"title":"Figure 4.4.2: Clinical and laboratory findings by day of illness in dengue","excerpt":"Day-by-day clinical/laboratory trajectory across febrile, critical, and convalescent phases, useful for recognizing the dangerous defervescence/critical-period transition."},
    {"type":"box","id":"4.4.1","page":274,"title":"Box 4.4.1: Recommendations for fluid management in patients with dengue","excerpt":"Fluid-management decision support, including oral hydration where possible and caution with intravenous fluids because excessive fluid can worsen complications during permeability changes."}
  ]
};

export const YELLOW_BOOK_ASSET_COUNT = Object.values(YELLOW_BOOK_SOURCE_ASSETS).reduce((sum, assets) => sum + assets.length, 0);
