const fs = require('fs');
const html = fs.readFileSync('aaron_specials_raw.html', 'utf-8');

const targetIdx = 413534; // index of "incentives":
const scriptStart = html.lastIndexOf('<script', targetIdx);
const scriptEnd = html.indexOf('</script>', targetIdx);

console.log('Script tag start:', scriptStart, 'end:', scriptEnd);
console.log('Script header:\n', html.substring(scriptStart, scriptStart + 300));
