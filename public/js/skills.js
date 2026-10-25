// Skill dictionary: [display name, category, ...aliases]. Aliases are matched on
// lower-case, accent-free text, so write them that way. English, French and German forms.
const RAW = [
  // Business, finance, consulting
  ["Financial modeling", "Finance", "financial modeling", "financial modelling", "modelisation financiere", "financial model"],
  ["Financial analysis", "Finance", "financial analysis", "analyse financiere", "financial analyst"],
  ["Accounting", "Finance", "accounting", "comptabilite", "buchhaltung", "bookkeeping"],
  ["Audit", "Finance", "audit", "auditing", "commissariat aux comptes"],
  ["Corporate finance", "Finance", "corporate finance", "finance d'entreprise"],
  ["M&A", "Finance", "m&a", "mergers and acquisitions", "fusions acquisitions", "fusions-acquisitions"],
  ["Valuation", "Finance", "valuation", "dcf", "discounted cash flow", "valorisation", "lbo"],
  ["Budgeting & forecasting", "Finance", "budgeting", "forecasting", "budget", "controle de gestion", "fp&a", "controlling"],
  ["Private equity", "Finance", "private equity", "capital investissement", "venture capital"],
  ["Asset management", "Finance", "asset management", "gestion d'actifs", "portfolio management"],
  ["Risk management", "Finance", "risk management", "gestion des risques", "risk analysis"],
  ["IFRS", "Finance", "ifrs", "us gaap", "gaap"],
  ["Bloomberg", "Finance", "bloomberg terminal", "bloomberg"],
  ["Treasury", "Finance", "treasury", "tresorerie", "cash management"],
  ["Tax", "Finance", "tax", "fiscalite", "taxation"],
  ["Strategy", "Business", "strategy", "strategie", "strategic planning", "corporate strategy"],
  ["Consulting", "Business", "consulting", "conseil", "management consulting", "beratung"],
  ["Business development", "Business", "business development", "developpement commercial", "bizdev"],
  ["Project management", "Business", "project management", "gestion de projet", "chef de projet", "projektmanagement", "project manager"],
  ["Product management", "Business", "product management", "product manager", "product owner", "chef de produit"],
  ["Agile / Scrum", "Business", "agile", "scrum", "kanban", "sprint"],
  ["Market research", "Business", "market research", "etude de marche", "etudes de marche", "marktforschung"],
  ["Business analysis", "Business", "business analysis", "business analyst"],
  ["Supply chain", "Operations", "supply chain", "logistique", "logistics", "logistik"],
  ["Procurement", "Operations", "procurement", "purchasing", "achats", "einkauf", "sourcing"],
  ["Operations management", "Operations", "operations management", "operations"],
  ["Lean / Six Sigma", "Operations", "lean", "six sigma", "continuous improvement", "amelioration continue"],
  ["Quality", "Operations", "quality assurance", "qualite", "iso 9001"],
  ["Human resources", "HR", "human resources", "ressources humaines", "hr", "rh", "personalwesen"],
  ["Recruitment", "HR", "recruitment", "recruiting", "recrutement", "talent acquisition", "sourcing candidats"],
  ["Payroll", "HR", "payroll", "paie"],
  ["Legal", "Legal", "legal", "juridique", "droit", "law", "contract law", "droit des affaires", "compliance"],
  ["GDPR", "Legal", "gdpr", "rgpd", "dsgvo", "data protection"],
  ["CSR / ESG", "Business", "csr", "rse", "esg", "sustainability", "developpement durable", "nachhaltigkeit"],
  ["Entrepreneurship", "Business", "entrepreneurship", "entrepreneuriat", "startup", "start-up"],

  // Marketing, sales, communication
  ["Digital marketing", "Marketing", "digital marketing", "marketing digital", "online marketing", "webmarketing", "growth marketing", "growth hacking"],
  ["Marketing", "Marketing", "marketing", "mercatique"],
  ["Brand management", "Marketing", "brand management", "branding", "brand manager", "gestion de marque"],
  ["SEO", "Marketing", "seo", "search engine optimization", "referencement naturel"],
  ["SEA / Paid ads", "Marketing", "sea", "sem", "google ads", "adwords", "paid search", "ppc", "meta ads", "facebook ads"],
  ["Social media", "Marketing", "social media", "reseaux sociaux", "community management", "community manager", "instagram", "tiktok", "linkedin ads"],
  ["Content marketing", "Marketing", "content marketing", "content creation", "copywriting", "redaction", "storytelling"],
  ["Email marketing", "Marketing", "email marketing", "emailing", "newsletter", "mailchimp", "brevo", "sendinblue"],
  ["CRM", "Sales", "crm", "customer relationship management", "gestion de la relation client"],
  ["Salesforce", "Sales", "salesforce", "sfdc"],
  ["HubSpot", "Sales", "hubspot"],
  ["Sales", "Sales", "sales", "vente", "ventes", "commercial", "vertrieb", "business developer", "account executive", "sdr", "bdr"],
  ["Key account management", "Sales", "key account", "account management", "grands comptes", "kam"],
  ["Negotiation", "Sales", "negotiation", "negociation", "verhandlung"],
  ["Customer service", "Sales", "customer service", "service client", "customer support", "customer success", "relation client", "kundenservice"],
  ["Retail", "Sales", "retail", "vente en magasin", "point de vente", "merchandising", "visual merchandising"],
  ["E-commerce", "Marketing", "e-commerce", "ecommerce", "shopify", "marketplace"],
  ["Communication", "Marketing", "communication", "corporate communication", "public relations", "relations presse", "pr"],
  ["Event management", "Marketing", "event management", "evenementiel", "event planning", "events"],
  ["Luxury", "Marketing", "luxury", "luxe", "luxe et mode", "fashion", "mode"],
  ["Google Analytics", "Data", "google analytics", "ga4", "web analytics"],

  // Data & tools
  ["Excel", "Tools", "excel", "microsoft excel", "spreadsheets", "vba", "tableaux croises dynamiques", "pivot tables"],
  ["PowerPoint", "Tools", "powerpoint", "ppt", "slides", "keynote"],
  ["Microsoft Office", "Tools", "microsoft office", "ms office", "office 365", "pack office", "word"],
  ["Google Workspace", "Tools", "google workspace", "google sheets", "g suite"],
  ["Power BI", "Data", "power bi", "powerbi"],
  ["Tableau", "Data", "tableau software", "tableau desktop", "tableau"],
  ["Looker", "Data", "looker", "looker studio", "data studio"],
  ["SQL", "Data", "sql", "mysql", "postgresql", "postgres", "t-sql", "bigquery", "snowflake"],
  ["Data analysis", "Data", "data analysis", "analyse de donnees", "data analyst", "datenanalyse", "data analytics"],
  ["Data visualization", "Data", "data visualization", "dataviz", "data visualisation"],
  ["Statistics", "Data", "statistics", "statistiques", "statistik", "econometrics", "econometrie"],
  ["Machine learning", "Data", "machine learning", "apprentissage automatique", "ml", "scikit-learn", "sklearn"],
  ["AI / LLM", "Data", "artificial intelligence", "intelligence artificielle", "generative ai", "genai", "llm", "prompt engineering", "chatgpt"],
  ["Deep learning", "Data", "deep learning", "tensorflow", "pytorch", "keras"],
  ["SAP", "Tools", "sap", "sap s/4hana", "erp"],
  ["Notion", "Tools", "notion"],
  ["Jira", "Tools", "jira", "confluence"],
  ["Figma", "Design", "figma"],
  ["Adobe Creative Suite", "Design", "adobe", "photoshop", "illustrator", "indesign", "premiere pro", "after effects", "lightroom", "creative suite"],
  ["Canva", "Design", "canva"],
  ["UX / UI design", "Design", "ux", "ui", "user experience", "user interface", "ux design", "ui design", "ux research"],
  ["Video editing", "Design", "video editing", "montage video", "final cut"],

  // Tech
  ["Python", "Tech", "python", "pandas", "numpy"],
  ["R", "Tech", "r", "r programming", "rstudio", "langage r"],
  ["JavaScript", "Tech", "javascript", "js", "ecmascript"],
  ["TypeScript", "Tech", "typescript", "ts"],
  ["React", "Tech", "react", "reactjs", "react.js", "next.js", "nextjs"],
  ["Vue", "Tech", "vue", "vuejs", "vue.js", "nuxt"],
  ["Angular", "Tech", "angular"],
  ["Node.js", "Tech", "node.js", "nodejs", "node", "express"],
  ["HTML / CSS", "Tech", "html", "css", "html5", "css3", "tailwind", "sass"],
  ["Java", "Tech", "java", "spring", "spring boot"],
  ["C#", "Tech", "c#", ".net", "dotnet", "asp.net"],
  ["C / C++", "Tech", "c++", "cpp", "langage c"],
  ["PHP", "Tech", "php", "laravel", "symfony", "wordpress"],
  ["Go", "Tech", "golang"],
  ["Ruby", "Tech", "ruby", "rails", "ruby on rails"],
  ["Swift / iOS", "Tech", "swift", "ios", "swiftui"],
  ["Kotlin / Android", "Tech", "kotlin", "android"],
  ["Cloud (AWS / Azure / GCP)", "Tech", "aws", "amazon web services", "azure", "gcp", "google cloud", "cloud"],
  ["DevOps", "Tech", "devops", "ci/cd", "docker", "kubernetes", "terraform", "jenkins"],
  ["Git", "Tech", "git", "github", "gitlab"],
  ["Linux", "Tech", "linux", "unix", "bash", "shell"],
  ["APIs", "Tech", "api", "rest", "rest api", "graphql"],
  ["Cybersecurity", "Tech", "cybersecurity", "cybersecurite", "security", "securite informatique", "iso 27001"],
  ["No-code", "Tech", "no-code", "nocode", "bubble", "zapier", "make", "airtable", "webflow"],

  // Hospitality, events, extras, retail floor
  ["Hospitality", "Hospitality", "hospitality", "hotellerie", "hotel", "hostellerie", "gastronomie"],
  ["Food & beverage service", "Hospitality", "waiter", "waitress", "server", "serveur", "serveuse", "service en salle", "barista", "bartender", "barman", "barmaid", "commis", "food and beverage", "f&b", "kellner"],
  ["Cooking", "Hospitality", "cook", "cuisinier", "cuisine", "chef de partie", "kitchen", "koch"],
  ["Reception", "Hospitality", "receptionist", "reception", "front desk", "accueil", "hote d'accueil", "hotesse d'accueil", "hostess"],
  ["Cashier", "Hospitality", "cashier", "caissier", "caissiere", "caisse", "kassierer"],
  ["Stock & inventory", "Operations", "inventory", "inventaire", "stock", "mise en rayon", "warehouse", "entrepot", "preparateur de commandes", "order picking"],
  ["Delivery / driving", "Operations", "delivery", "livraison", "livreur", "driver", "chauffeur", "permis b", "driving licence", "driver's license"],
  ["Tutoring / teaching", "Education", "tutoring", "tutor", "soutien scolaire", "cours particuliers", "teaching", "enseignement", "nachhilfe"],
  ["Childcare", "Education", "childcare", "baby-sitting", "babysitting", "garde d'enfants", "nanny"],
  ["Promotion / street marketing", "Marketing", "promoter", "street marketing", "animation commerciale", "animateur", "brand ambassador", "ambassadeur"],
  ["Data entry", "Tools", "data entry", "saisie de donnees", "saisie"],

  // Languages
  ["English", "Languages", "english", "anglais", "englisch", "toeic", "toefl", "ielts", "cambridge"],
  ["French", "Languages", "french", "francais", "franzosisch"],
  ["German", "Languages", "german", "allemand", "deutsch"],
  ["Spanish", "Languages", "spanish", "espagnol", "spanisch"],
  ["Italian", "Languages", "italian", "italien", "italienisch"],
  ["Portuguese", "Languages", "portuguese", "portugais"],
  ["Chinese", "Languages", "chinese", "mandarin", "chinois"],
  ["Arabic", "Languages", "arabic", "arabe"],
  ["Japanese", "Languages", "japanese", "japonais"],
  ["Dutch", "Languages", "dutch", "neerlandais"],

  // Soft skills (lower weight)
  ["Teamwork", "Soft skills", "teamwork", "team player", "travail en equipe", "esprit d'equipe", "teamfahigkeit"],
  ["Leadership", "Soft skills", "leadership", "team lead", "management d'equipe", "people management", "manager"],
  ["Communication skills", "Soft skills", "communication skills", "interpersonal", "aisance relationnelle", "excellent communication", "kommunikationsfahigkeit"],
  ["Problem solving", "Soft skills", "problem solving", "problem-solving", "resolution de problemes", "analytical skills", "esprit d'analyse", "analytical mind"],
  ["Autonomy", "Soft skills", "autonomy", "autonomie", "autonome", "self-starter", "independent"],
  ["Organization", "Soft skills", "organisation", "organization", "organized", "organise", "rigueur", "rigoureux", "attention to detail", "detail-oriented"],
  ["Adaptability", "Soft skills", "adaptability", "adaptabilite", "flexibility", "flexible", "polyvalence", "polyvalent"],
  ["Creativity", "Soft skills", "creativity", "creativite", "creative", "creatif"],
  ["Customer focus", "Soft skills", "customer focus", "customer-oriented", "sens du service", "client-oriented", "service-minded"],
  ["Presentation", "Soft skills", "presentation skills", "public speaking", "prise de parole", "pitch"],
];

const SOFT = new Set(["Soft skills"]);

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Short acronyms are ambiguous in lower case ("r", "ui", "sea"...), so they only count
// when written in UPPER CASE in the original text.
const ACRONYMS = new Set(["r", "ts", "js", "ui", "ux", "pr", "sea", "sem", "ml", "hr", "rh", "sap", "kam", "ppt"]);
// Ambiguous everyday words: dropped from matching entirely (more specific aliases cover them).
const SKIP = new Set(["node", "make", "word", "stock", "server", "manager", "security", "operations", "cloud", "events", "budget", "mode", "saisie", "caisse", "hotel", "independent", "flexible", "creative", "pitch", "slides", "sprint", "rest", "tableau", "droit", "conseil"]);

export const SKILLS = RAW.map(([name, category, ...aliases]) => ({
  name,
  category,
  weight: SOFT.has(category) ? 0.4 : category === "Languages" ? 0.7 : 1,
  patterns: aliases.filter((a) => !SKIP.has(a)).map((a) => {
    const acronym = ACRONYMS.has(a);
    const body = escapeRe(acronym ? a.toUpperCase() : a).replace(/\s+/g, "[\\s\\-_]+");
    return acronym
      ? { acronym, re: new RegExp(`(?<![A-Za-z0-9+#.])${body}(?![A-Za-z0-9+#&])`) }
      : { acronym, re: new RegExp(`(?<![a-z0-9+#.])${body}(?![a-z0-9+#])`) };
  }),
}));

const BY_NAME = new Map(SKILLS.map((s) => [s.name.toLowerCase(), s]));
export function skillByName(name) {
  return BY_NAME.get(String(name).toLowerCase());
}

// Returns a Set of skill names found in the text.
export function extractSkills(text) {
  const norm = normalize(text);
  const cased = String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const found = new Set();
  for (const s of SKILLS) {
    if (s.patterns.some((p) => p.re.test(p.acronym ? cased : norm))) found.add(s.name);
  }
  return found;
}
