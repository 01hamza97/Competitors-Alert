const { SpecialsExtractor } = require('./dist/services/specialsExtractor');

async function test() {
  for (const url of [
    'https://www.worldoffordalexandria.com/promotions/new/index.htm',
    'https://www.worldoffordalexandria.com/featured-vehicles/new.htm',
    'https://www.worldoffordalexandria.com/global-incentives/index.htm'
  ]) {
    console.log(`\n========================================`);
    console.log(`Testing URL: ${url}`);
    const html = await SpecialsExtractor.fetchSpecialsHtml(url);
    if (!html) {
      console.log('No HTML');
      continue;
    }
    const ext = await SpecialsExtractor.extract(html, url, 'world_of_ford_alexandria', 'World Of Ford Alexandria');
    console.log(`Results: HTML specials = ${ext.htmlSpecials.length}, Visual specials = ${ext.visualSpecials.length}`);
    if (ext.htmlSpecials.length > 0) {
      console.log('Sample HTML special:', ext.htmlSpecials[0]);
    }
    if (ext.visualSpecials.length > 0) {
      console.log('Sample visual special:', ext.visualSpecials[0]);
    }
  }
}

test().catch(console.error);
