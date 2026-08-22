export async function runScrapeJob() {
  console.log(`[scrapeJob] Run started at ${new Date().toISOString()}`);

  try {
    // 1. Call Apify service to scrape Facebook
    // const rawResults = await scrapeFacebook(keyword);

    // 2. Filter out already-seen profiles (dedup)
    // const newLeads = await filterNewLeads(rawResults);

    // 3. Run LLM qualification on each new lead
    // const qualifiedLeads = await qualifyLeads(newLeads);

    // 4. Save qualified leads to MongoDB
    // await saveLeads(qualifiedLeads);

    console.log(`[scrapeJob] Run completed`);
  } catch (err) {
    console.error(`[scrapeJob] Run failed`, err);
  }
}