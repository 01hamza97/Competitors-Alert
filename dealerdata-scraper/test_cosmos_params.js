const axios = require('axios');

async function testParams() {
  const base = "https://www.waldorfford.com/api/vhcliaa/vehicle-pages/cosmos/srp/vehicles/13703/904369?host=www.waldorfford.com&baseFilter=dHlwZT0nbicgQU5EIChub3QodmVoaWNsZXN0YWdldGV4dCA9ICdkZWFsZXIgb3JkZXJlZCcpKQ==";
  const p1Res = await axios.get(base, { headers: { "User-Agent": "Mozilla/5.0" } });
  const p1Vins = p1Res.data.DisplayCards.map(c => c.VehicleCard?.Vin).filter(Boolean);
  console.log('Page 1 first 3 VINs:', p1Vins.slice(0, 3));

  const candidates = [
    'page=2',
    'p=2',
    'pageNumber=2',
    'pg=2',
    'pn=12&page=2',
    'pageindex=1',
    'pageindex=2',
    'start=12',
    'skip=12',
    'offset=12',
    'pageStart=12',
    'displayCardsShown=12',
    'displayCardsShown=24',
    'pageNumber=2&displayCardsShown=12',
    'page=2&displayCardsShown=12'
  ];

  for (const c of candidates) {
    try {
      const res = await axios.get(`${base}&${c}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const vins = (res.data.DisplayCards || []).map(x => x.VehicleCard?.Vin).filter(Boolean);
      const isDiff = vins.length > 0 && vins[0] !== p1Vins[0];
      console.log(`Param "${c}" -> count: ${vins.length}, diff from p1: ${isDiff}, firstVin: ${vins[0]}`);
      if (isDiff) {
        console.log(`🎉 FOUND WORKING PARAM: ${c}!`);
      }
    } catch (e) {
      console.log(`Param "${c}" error:`, e.message);
    }
  }
}

testParams().catch(console.error);
