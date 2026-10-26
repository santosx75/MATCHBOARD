// Biggest job boards without a public API: we open their own search, pre-filled with the profile.
const nearest = (v, list) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

const LINKEDIN_JT = { cdi: "F", cdd: "C", interim: "T", internship: "I", parttime: "P", volunteer: "V", freelance: "C" };

export function platformLinks({ role, city, radius, contracts }) {
  const q = encodeURIComponent(role || "");
  const l = encodeURIComponent(city || "");
  const jt = [...new Set(contracts.map((c) => LINKEDIN_JT[c]).filter(Boolean))].join(",");
  const miles = nearest(radius * 0.621, [5, 10, 25, 50, 100]);

  return [
    { name: "LinkedIn Jobs", tag: "All jobs", url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}&distance=${miles}${jt ? `&f_JT=${jt}` : ""}` },
    { name: "Indeed", tag: "All jobs", url: `https://fr.indeed.com/jobs?q=${q}&l=${l}&radius=${nearest(radius, [0, 5, 10, 15, 25, 35, 50, 100])}` },
    { name: "Welcome to the Jungle", tag: "Startups & brands", url: `https://www.welcometothejungle.com/en/jobs?query=${q}${city ? `&aroundQuery=${l}` : ""}` },
    { name: "France Travail", tag: "All contracts · France", url: `https://candidat.francetravail.fr/offres/recherche?motsCles=${q}&offresPartenaires=true` },
  ];
}
