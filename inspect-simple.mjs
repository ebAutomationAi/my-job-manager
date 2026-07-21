import { chromium } from 'playwright';

async function inspect(source, url) {
  console.log(`\n=== ${source} ===`);
  console.log(`URL: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Get all text content and look for patterns
    const pageText = await page.textContent('body');
    const lines = pageText.split('\n').filter(l => l.trim().length > 20);

    // Look for description sections
    console.log(`\nPage structure detected:`);
    console.log(`Total text lines: ${lines.length}`);

    // Sample of substantial text blocks
    const substantial = lines.filter(l => l.length > 50).slice(0, 5);
    substantial.forEach((line, i) => {
      console.log(`[${i}] ${line.substring(0, 100)}`);
    });

    // Check for schedule keywords
    const hasSchedule = ['turno', 'nocturno', 'horario', 'jornada', 'shift', 'schedule'].some(
      kw => pageText.toLowerCase().includes(kw)
    );
    console.log(`\nSchedule info: ${hasSchedule ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error(`Error: ${error.message}`);
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
    await inspect(source, url);
    console.log('\n' + '='.repeat(60));
  }
})().catch(console.error);
