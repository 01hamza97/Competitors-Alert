const axios = require('axios');

async function test() {
  const res = await axios.get('https://www.banisterfordofmarlowheights.com/new-vehicles/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  const html = res.data;
  
  const idx = html.indexOf('typesenseAdapter');
  if (idx !== -1) {
    console.log('typesenseAdapter snippet:\n', html.slice(Math.max(0, idx - 100), idx + 600));
  }
}

test();
