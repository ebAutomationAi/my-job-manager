import { chromium } from 'playwright';

async function detailedInspect(source, url) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 ${source} — DETAILED INSPECTION`);
  console.log(`${'='.repeat(70)}`);
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Get page HTML to analyze structure
    const html = await page.content();

    // Try multiple selector strategies
    const selectors = [
      { name: 'main', sel: 'main' },
      { name: 'article', sel: 'article' },
      { name: '[data-testid="description"]', sel: '[data-testid="description"]' },
      { name: '[class*="description"]', sel: '[class*="description"]' },
      { name: '[class*="job-description"]', sel: '[class*="job-description"]' },
      { name: '[class*="offer-detail"]', sel: '[class*="offer-detail"]' },
      { name: '[class*="content"]', sel: '[class*="content"]:not(nav)' },
      { name: '.job-description', sel: '.job-description' },
      { name: '.offer-body', sel: '.offer-body' },
      { name: '.job-content', sel: '.job-content' },
    ];

    console.log('Testing selectors:\n');

    for (const {name, sel} of selectors) {
      try {
        const text = await page.textContent(sel);
        if (text && text.trim().length > 100) {
          console.log(`✓ ${name} — Found ${text.length} chars`);

          // Extract schedule-related keywords
          const scheduleKeywords = ['turno', 'nocturno', 'diurno', 'jornada', 'horario', 'shift', 'schedule', 'horas'];
          const foundKeywords = scheduleKeywords.filter(kw => text.toLowerCase().includes(kw));
          console.log(`  Schedule keywords found: ${foundKeywords.length > 0 ? foundKeywords.join(', ') : 'none'}`);

          // Show preview
          const preview = text.replace(/\s+/g, ' ').substring(0, 250);
          console.log(`  Preview: ${preview}...\n`);

          break; // Use first selector that works
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

const offers = {
  'Infojobs': 'https://www.infojobs.net/barcelona/recepcionista/of-i1386cbe51c4bfe9c572a1d6620fc37',
  'Adecco': 'https://www.adecco.com/es-es/ofertas-trabajo/recepcionista-temporal-esplugues-de-llobregat-barcelona/648493eecbbf7d29f9a157dd9ba91838',
  'Manpower': 'https://www.manpower.es/es/empleos/educacion/recepcionista-temporal-con-catalan-e-ingles-h-m-x-/737201'
};

(async () => {
  for (const [source, url] of Object.entries(offers)) {
    await detailedInspect(source, url);
  }
  console.log(`\n${'='.repeat(70)}\n`);
})().catch(console.error);
