import { chromium } from 'playwright';

const offers = {
  'Infojobs': 'https://www.infojobs.net/barcelona/recepcionista/of-i1386cbe51c4bfe9c572a1d6620fc37',
  'Adecco': 'https://www.adecco.com/es-es/ofertas-trabajo/recepcionista-temporal-esplugues-de-llobregat-barcelona/648493eecbbf7d29f9a157dd9ba91838',
  'Manpower': 'https://www.manpower.es/es/empleos/educacion/recepcionista-temporal-con-catalan-e-ingles-h-m-x-/737201'
};

async function inspect(source, url) {
  console.log(`\n📋 INSPECTING ${source}\n`);
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for rendering

    // Try common description selectors
    const selectors = {
      'Infojobs': [
        '[class*="description"]',
        '[class*="offer"]',
        'main',
        '[class*="content"]',
        '[class*="job"]'
      ],
      'Adecco': [
        '[class*="description"]',
        '[class*="offer"]',
        'main',
        '[class*="content"]',
        '[class*="job"]'
      ],
      'Manpower': [
        '[class*="description"]',
        '[class*="offer"]',
        'main',
        '[class*="content"]',
        '[class*="job"]'
      ]
    };

    for (const sel of selectors[source] || []) {
      const text = await page.textContent(sel).catch(() => null);
      if (text && text.length > 100) {
        console.log(`✓ Selector found: ${sel}`);
        console.log(`Text preview (300 chars):\n${text.substring(0, 300)}...\n`);

        // Check for shift/schedule keywords
        const keywords = ['turno', 'nocturno', 'horario', 'jornada', 'schedule', 'shift'];
        const hasSchedule = keywords.some(kw => text.toLowerCase().includes(kw));
        console.log(`Schedule info present: ${hasSchedule ? '✓ YES' : '✗ NO'}\n`);
        break;
      }
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  await browser.close();
}

// Inspect each source
(async () => {
  for (const [source, url] of Object.entries(offers)) {
    await inspect(source, url);
  }
})();
