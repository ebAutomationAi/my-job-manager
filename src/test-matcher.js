// src/test-matcher.js — temporary diagnostic — new file
import BaseScraper from './scrapers/base-scraper.js';
import { matchOffer } from './matcher.js';

async function testSource(sourceId, searchUrl, containerSelector, titleSelector, keyword) {
  const scraper = new BaseScraper(keyword);
  await scraper.initialize();

  await scraper.page.goto(searchUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await scraper.acceptCookies();
  await scraper.page.waitForTimeout(2000);

  const containers = await scraper.page.$$(containerSelector);
  console.log(`\n===== ${sourceId.toUpperCase()} keyword="${keyword}" =====`);
  console.log(`Containers: ${containers.length}`);

  for (let i = 0; i < Math.min(containers.length, 5); i++) {
    const title = await containers[i].$eval(
      titleSelector,
      n => n.innerText?.trim().substring(0, 150) ?? ''
    ).catch(() => '');

    // Simular el mismo procesamiento que quick-search.js
    let titleForMatch = title;
    if (keyword && !title.toLowerCase().includes(keyword.toLowerCase())) {
      titleForMatch = title + ' ' + keyword;
    }

    const offer = {
      title: titleForMatch,
      description: '',
      url: 'https://example.com/x',
      ett_id: sourceId,
      ett_name: sourceId,
      keyword_used: keyword,
      source: sourceId,
    };

    const m = matchOffer(offer);
    console.log(`[${i}] "${title}"`);
    console.log(`     titleForMatch="${titleForMatch}"`);
    console.log(`     score_RCP=${m.score_RCP} is_relevant=${m.is_relevant} excluded=${m.excluded} matched_terms=${JSON.stringify(m.matched_terms_RCP)}`);
  }

  await scraper.close();
}

await testSource(
  'infojobs',
  'https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=recepcionista&provinceIds=9&sortBy=RELEVANCE&countryIds=17&sinceDate=ANY',
  '.ij-OfferList-offerCardItem',
  'h2 a, h3 a, a[class*="title"], h2, h3',
  'recepcionista'
);

await testSource(
  'manpower',
  'https://www.manpower.es/es/buscar-trabajo?page=1&searchKeyword=recepcionista&latitude=41.3874374&longitude=2.1686496&place=Barcelona,+España',
  '.job-search-result.card',
  'h2.title, h2.title.manpower, h2, h3',
  'recepcionista'
);