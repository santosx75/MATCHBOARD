// Job boards without a public API: we open their own search, pre-filled with the profile.
const nearest = (v, list) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

const LINKEDIN_JT = { cdi: "F", cdd: "C", interim: "T", internship: "I", parttime: "P", volunteer: "V", freelance: "C" };

export function platformLinks({ role, city, radius, contracts }) {
  const q = encodeURIComponent(role || "");
  const l = encodeURIComponent(city || "");
  const has = (id) => contracts.includes(id);
  const studentish = has("internship") || has("apprenticeship") || has("student");
  const extras = has("extras") || has("seasonal") || has("student") || has("parttime");

  const jt = [...new Set(contracts.map((c) => LINKEDIN_JT[c]).filter(Boolean))].join(",");
  const miles = nearest(radius * 0.621, [5, 10, 25, 50, 100]);

  const links = [
    { name: "LinkedIn Jobs", tag: "All jobs", url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}&distance=${miles}${jt ? `&f_JT=${jt}` : ""}` },
    { name: "Indeed", tag: "All jobs", url: `https://fr.indeed.com/jobs?q=${q}&l=${l}&radius=${nearest(radius, [0, 5, 10, 15, 25, 35, 50, 100])}` },
    { name: "Welcome to the Jungle", tag: "Startups & brands", url: `https://www.welcometothejungle.com/en/jobs?query=${q}${city ? `&aroundQuery=${l}` : ""}` },
    { name: "HelloWork", tag: "All jobs · France", url: `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${q}&l=${l}&ray=${nearest(radius, [10, 20, 30, 50, 100, 200])}` },
    { name: "JobTeaser", tag: "Students & grads", url: `https://www.jobteaser.com/en/job-offers?q=${q}` },
    { name: "France Travail", tag: "All contracts · France", url: `https://candidat.francetravail.fr/offres/recherche?motsCles=${q}&offresPartenaires=true` },
    { name: "APEC", tag: "Graduates & executives", url: `https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=${q}` },
    { name: "Glassdoor", tag: "Jobs + salaries", url: `https://www.glassdoor.fr/Job/jobs.htm?sc.keyword=${q}` },
    { name: "StudentJob", tag: "Student jobs", url: "https://www.studentjob.fr/" },
    { name: "StaffMe", tag: "Extras & missions", url: "https://staffme.fr/" },
    { name: "Side", tag: "Temp & extras", url: "https://www.side.co/" },
    { name: "Brigad", tag: "Hospitality extras", url: "https://brigad.co/" },
  ];
  // Put the most relevant boards first for the chosen contracts.
  const weight = (x) => (extras && /extras|temp|student/i.test(x.tag) ? -2 : 0) + (studentish && /student/i.test(x.tag) ? -1 : 0);
  return links.map((x, i) => ({ ...x, i })).sort((a, b) => weight(a) - weight(b) || a.i - b.i);
}
