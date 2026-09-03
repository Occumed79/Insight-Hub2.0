import { Router, type IRouter } from "express";

const router: IRouter = Router();

type DiseaseConfig = { title: string; sourceTable: string; rows: string };
const SOURCE_URL = "https://doi.org/10.3390/jof3040057";

const DISEASES: Record<string, DiseaseConfig> = {
  candidemia: {
    title: "Candidaemia / invasive candidiasis",
    sourceTable: "Table 2",
    rows: `Brazil|BR|28991|14.9
Pakistan|PK|38795|21
Qatar|QA|288|15.4
Thailand|TH|8650|13.3
Hungary|HU|1110|11
Israel|IL|664|11
Denmark|DK|527|9.4
Russia|RU|11840|8.3
Spain|ES|3807|8.1
United Kingdom|GB|5142|8.1
Ireland|IE|403|6.3
Nigeria|NG|9284|6
Uzbekistan|UZ|1825|5.9
Algeria|DZ|2020|5
Bangladesh|BD|8100|5
Belgium|BE|555|5
Chile|CL|878|5
Czech Republic|CZ|526|5
Dominican Republic|DO|504|5
Ecuador|EC|1037|5
Egypt|EG|4127|5
Greece|GR|541|5
Guatemala|GT|772|5
Jamaica|JM|136|5
Kenya|KE|1990|5
Mexico|MX|5617|5
Peru|PE|1557|5
Tanzania|TZ|2181|5
Trinidad and Tobago|TT|87|5
Ukraine|UA|752|5
Vietnam|VN|4540|5
Germany|DE|3712|4.6
South Korea|KR|1976|4.1
France|FR|2370|3.6
Canada|CA|1034|2.9
Austria|AT|209|2.6
Sri Lanka|LK|507|2.5
Portugal|PT|231|2.2
Philippines|PH|1968|2`,
  },
  "invasive-aspergillosis": {
    title: "Invasive aspergillosis",
    sourceTable: "Table 3",
    rows: `Vietnam|VN|14523|16
Egypt|EG|9001|10.7
Greece|GR|1125|10.4
Algeria|DZ|2865|7.1
Ireland|IE|445|7
Israel|IL|574|6.8
Belgium|BE|675|6.1
Pakistan|PK|10949|5.9
Ecuador|EC|748|5.5
Denmark|DK|294|5.3
Bangladesh|BD|5166|5.1
Germany|DE|4280|5.1
Peru|PE|1621|5
Uzbekistan|UZ|1521|4.8
United Kingdom|GB|2912|4.6
Brazil|BR|1854|4.5
South Korea|KR|2150|4.5
Guatemala|GT|671|4.3
Austria|AT|333|4.1
Mexico|MX|4510|4
Nepal|NP|1119|4
Uganda|UG|389|3.8
Hungary|HU|319|3.2
Philippines|PH|3085|3
Czech Republic|CZ|297|2.8
Spain|ES|1293|2.8
Ukraine|UA|1233|2.7
Portugal|PT|243|2.3
Russia|RU|3238|2.3
France|FR|1185|1.8
Chile|CL|296|1.7
Canada|CA|566|1.6
Thailand|TH|941|1.4
Sri Lanka|LK|229|1.1
Dominican Republic|DO|61|0.8
Kenya|KE|239|0.6
Nigeria|NG|928|0.6
Qatar|QA|11|0.6
Trinidad and Tobago|TT|8|0.6
Tanzania|TZ|20|0.1`,
  },
  pcp: {
    title: "Pneumocystis jirovecii pneumonia",
    sourceTable: "Table 4",
    rows: `Nigeria|NG|74595|48.2
Kenya|KE|17000|43
Trinidad and Tobago|TT|400|30
Tanzania|TZ|9600|22
Ukraine|UA|6152|13.5
Jamaica|JM|350|13
Senegal|SN|1149|8.2
Uzbekistan|UZ|165|5.37
Guatemala|GT|722|4.7
Peru|PE|1447|4.6
Mexico|MX|5130|4.5
Chile|CL|766|4.3
Nepal|NP|990|3.6
Spain|ES|305|3.4
Ecuador|EC|535|3.28
Thailand|TH|1708|2.6
Dominican Republic|DO|234|2.31
Brazil|BR|4115|2.1
Germany|DE|1013|1.3
Pakistan|PK|2200|1.2
Belgium|BE|120|1.1
France|FR|658|1
Greece|GR|112|1
Uganda|UG|412|1
Ireland|IE|50|0.8
Qatar|QA|15|0.8
Canada|CA|252|0.71
Czech Republic|CZ|72|0.7
Vietnam|VN|608|0.67
Portugal|PT|65|0.62
South Korea|KR|245|0.51
Philippines|PH|391|0.4
United Kingdom|GB|207|0.33
Israel|IL|26|0.3
Algeria|DZ|74|0.18
Russia|RU|1414|0.16
Egypt|EG|125|0.15
Hungary|HU|5|0.1
Bangladesh|BD|58|0.04
Denmark|DK|2|0.04`,
  },
  cpa: {
    title: "Chronic pulmonary aspergillosis",
    sourceTable: "Table 5",
    rows: `Russia|RU|52311|126.2
Nigeria|NG|120747|78
Philippines|PH|77172|78
Pakistan|PK|72438|70
Vietnam|VN|55509|61
Dominican Republic|DO|1374|55
Uganda|UG|18000|46
Bangladesh|BD|20720|41
Kenya|KE|12927|32
Thailand|TH|19044|29.2
Belgium|BE|662|27.7
Qatar|QA|176|26.8
Nepal|NP|6611|24.2
India|IN|209147|24
Tanzania|TZ|10437|24
South Korea|KR|10754|22.4
Ukraine|UA|10054|22
Senegal|SN|2700|19
Mexico|MX|18246|15.9
Sri Lanka|LK|2886|14.4
Egypt|EG|3015|13.8
Peru|PE|3593|11
Guatemala|GT|1484|9.6
Spain|ES|4318|9.19
Trinidad and Tobago|TT|110|8.2
Chile|CL|1212|6.9
Uzbekistan|UZ|1941|6.3
Brazil|BR|12032|6.2
Hungary|HU|504|6
United Kingdom|GB|3600|5.7
France|FR|3450|5.2
Denmark|DK|270|4.8
Austria|AT|328|4.7
Greece|GR|386|3.7
Czech Republic|CZ|365|3.5
Ecuador|EC|2100|3.28
Ireland|IE|196|3.1
Portugal|PT|776|3.1
Jamaica|JM|82|3
Germany|DE|2320|2.9
Israel|IL|200|2.5
Algeria|DZ|897|2.2
Canada|CA|492|1.4`,
  },
  abpa: {
    title: "Allergic bronchopulmonary aspergillosis",
    sourceTable: "Table 6",
    rows: `United Kingdom|GB|235070|372
Trinidad and Tobago|TT|3491|260
Dominican Republic|DO|25149|249
Belgium|BE|23119|208.3
Brazil|BR|390486|201.3
Greece|GR|20843|193
Jamaica|JM|5116|188
Ecuador|EC|26642|185
Canada|CA|61854|174
Egypt|EG|133834|162
Spain|ES|59210|156
Germany|DE|123960|154
France|FR|95331|145
Ireland|IE|8960|140
Hungary|HU|13129|132.5
Denmark|DK|7328|131
Philippines|PH|121113|123
Russia|RU|175082|122.5
Portugal|PT|12600|119
India|IN|1380000|114
Israel|IL|8297|101
Chile|CL|17183|97.9
Austria|AT|7537|91.7
Algeria|DZ|31310|77
Peru|PE|22453|72
Senegal|SN|9976|71
Ukraine|UA|28447|62.4
Nigeria|NG|93649|60.5
Qatar|QA|1126|60.2
Mexico|MX|47855|60
Thailand|TH|38009|58.4
South Korea|KR|27312|56.9
Bangladesh|BD|90262|56
Pakistan|PK|94358|51
Sri Lanka|LK|10344|49
Uganda|UG|18700|47.9
Czech Republic|CZ|4739|45
Kenya|KE|17696|44
Tanzania|TZ|18987|44
Guatemala|GT|5568|36.1
Nepal|NP|9546|35
Vietnam|VN|23607|23
Uzbekistan|UZ|879|2.9`,
  },
  safs: {
    title: "Severe asthma with fungal sensitisation",
    sourceTable: "Table 7",
    rows: `United Kingdom|GB|413724|654
Trinidad and Tobago|TT|4608|344
Dominican Republic|DO|33197|329
Ecuador|EC|45183|311
Brazil|BR|599283|288
Belgium|BE|30402|273
Greece|GR|27744|256
Jamaica|JM|6753|248
Egypt|EG|176661|214
Canada|CA|73344|206
Germany|DE|163131|203
Spain|ES|93044|198
France|FR|124678|189
Ireland|IE|111675|182
Hungary|HU|17330|175
Philippines|PH|159869|162
Russia|RU|231000|161
Portugal|PT|16614|159
Denmark|DK|7793|139
Chile|CL|22300|127
Austria|AT|9949|121
Algeria|DZ|41329|102
Peru|PE|29638|95
Senegal|SN|13168|93
Ukraine|UA|37491|82
India|IN|960000|80
Qatar|QA|1486|80
Nigeria|NG|120753|78
Thailand|TH|50172|77
South Korea|KR|36052|75
Bangladesh|BD|119146|74
Pakistan|PK|129776|70
Israel|IL|5540|68
Sri Lanka|LK|13654|65
Czech Republic|CZ|6581|62
Uganda|UG|24684|62
Kenya|KE|23359|58
Tanzania|TZ|25063|57
Mexico|MX|66997|53
Guatemala|GT|7349|48
Nepal|NP|12600|46
Vietnam|VN|31161|34
Uzbekistan|UZ|1147|3.7`,
  },
  "fungal-keratitis": {
    title: "Fungal keratitis",
    sourceTable: "Table 8",
    rows: `Nepal|NP|19938|73
Pakistan|PK|80553|44
Thailand|TH|9765|15
Egypt|EG|11550|14
Mexico|MX|11638|10.4
Vietnam|VN|6356|7
Sri Lanka|LK|100000|6.3
Qatar|QA|6|1.68
China|CN|17038|1.3
Philippines|PH|358|0.36
South Korea|KR|29|0.06
Denmark|DK|3|0.05
Germany|DE|32|0.04`,
  },
};

function parseRows(config: DiseaseConfig) {
  return config.rows.split("\n").filter(Boolean).map((line) => {
    const [country, iso2, burden, rate] = line.split("|");
    return { country, iso2, burden: Number(burden), ratePer100k: Number(rate) };
  });
}

router.get("/aor/fungal-burden", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  const requested = String(req.query.disease || "cpa").trim().toLowerCase();
  const diseaseKey = DISEASES[requested] ? requested : "cpa";
  const config = DISEASES[diseaseKey];
  const rows = parseRows(config).sort((a, b) => b.ratePer100k - a.ratePer100k);
  const country = String(req.query.country || "").trim().toLowerCase();
  const selected = country ? rows.filter((row) => row.iso2.toLowerCase() === country || row.country.toLowerCase() === country) : rows;

  return res.json({
    ok: true,
    disease: { key: diseaseKey, title: config.title, sourceTable: config.sourceTable },
    availableDiseases: Object.entries(DISEASES).map(([key, value]) => ({ key, title: value.title, sourceTable: value.sourceTable })),
    rows: selected,
    source: "Bongomin et al., Journal of Fungi 2017",
    sourceUrl: SOURCE_URL,
    publicationYear: 2017,
    modeledEstimate: true,
    methodology: "Country figures reproduce the review's published modeled burden and rate-per-100,000 tables. Estimates were assembled from heterogeneous surveillance, literature and assumption-based methods and were intended as rough burden approximations, not comprehensive surveillance.",
    limitation: "Historical modeled burden only. Do not interpret these values as current outbreak activity, current incidence, current prevalence or a present-day travel-risk score. Country coverage and estimate precision vary materially by disease.",
  });
});

export default router;
