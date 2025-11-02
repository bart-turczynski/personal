module.exports = (data = {}) => {
  const site = data.site || {};

  const siteUrl = site.url || "";

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.author?.name || site.title,
    url: siteUrl || undefined,
    image: site.author?.image || (siteUrl ? `${siteUrl}/favicon-512x512.png` : undefined),
    email: site.author?.email,
    sameAs: Array.isArray(site.author?.sameAs) ? site.author.sameAs : [],
    jobTitle: site.author?.jobTitle,
    worksFor: site.author?.worksFor,
  };

  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    url: siteUrl || undefined,
    description: site.description,
    inLanguage: site.language || "en",
    publisher: person,
  };

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: site.title,
    url: siteUrl || undefined,
    description: site.description,
  };

  return [person, webSite, webPage];
};

