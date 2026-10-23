// Hard-coded store configuration for the Specials Entry Tool.
// Each entry: { value, label, dealer_id, group_name, homepage, specials_url, competitors[] }
export const SPECIALS_STORES = [
  {
    value: 'aaron_ford_escondido',
    label: 'Aaron Ford Escondido',
    dealer_id: 'aaron_ford_escondido',
    group_name: 'Aaron Automotive Group',
    homepage: 'https://www.aaronfordescondido.com',
    specials_url: 'https://www.aaronfordescondido.com/new-vehicles/new-vehicle-specials/',
    competitors: [
      {
        label: 'Encinitas Ford',
        homepage: 'https://www.encinitasford.com',
        specials_url: 'https://www.encinitasford.com/new-vehicles/new-vehicle-specials/',
      },
      {
        label: 'Ken Grody Ford Carlsbad',
        homepage: 'https://www.kengrodyfordsandiego.com',
        specials_url: 'https://www.kengrodyfordsandiego.com/new-vehicles/new-vehicle-specials/',
      },
    ],
  },
  {
    value: 'aaron_ford_lake_elsinore',
    label: 'Aaron Ford Lake Elsinore',
    dealer_id: 'aaron_ford_lake_elsinore',
    group_name: 'Aaron Automotive Group',
    homepage: 'https://www.aaronfordlakeelsinore.com',
    specials_url: 'https://www.aaronfordlakeelsinore.com/new-vehicles/new-vehicle-specials/',
    competitors: [],
  },
  {
    value: 'aaron_cdjr',
    label: 'Aaron CDJR',
    dealer_id: 'aaron_cdjr',
    group_name: 'Aaron Automotive Group',
    homepage: 'https://www.aaronchryslerdodgejeepram.com',
    specials_url: 'https://www.aaronchryslerdodgejeepram.com/new-vehicles/new-vehicle-specials/',
    competitors: [
      {
        label: 'Ontario CDJR',
        homepage: 'https://www.jeepchryslerdodgeramofontario.com',
        specials_url: 'https://www.jeepchryslerdodgeramofontario.com/new-vehicles/new-vehicle-specials/',
      },
      {
        label: 'J Star CDJR',
        homepage: 'https://www.jstarcdjrofanaheimhills.com',
        specials_url: 'https://www.jstarcdjrofanaheimhills.com/specials/',
      },
      {
        label: 'Moss Bros CDJR',
        homepage: 'https://www.mossbroscdjr.com',
        specials_url: 'https://www.mossbroscdjr.com/specials/',
      },
    ],
  },
  {
    value: 'aaron_chevrolet',
    label: 'Aaron Chevrolet',
    dealer_id: 'aaron_chevrolet',
    group_name: 'Aaron Automotive Group',
    homepage: 'https://www.aaronchevrolet.com',
    specials_url: 'https://www.aaronchevrolet.com/new-vehicles/new-vehicle-specials/',
    competitors: [],
  },
  {
    value: 'aaron_kia',
    label: 'Aaron Kia',
    dealer_id: 'aaron_kia',
    group_name: 'Aaron Automotive Group',
    homepage: 'https://www.aaronkia.com',
    specials_url: 'https://www.aaronkia.com/specials/',
    competitors: [],
  },
  {
    value: 'geaux_chevrolet',
    label: 'Geaux Chevrolet',
    dealer_id: 'geaux_chevrolet',
    group_name: 'Geaux Chevrolet',
    homepage: 'https://www.geauxchevrolet.com',
    specials_url: 'https://www.geauxchevrolet.com/new-vehicles/new-vehicle-specials/',
    competitors: [
      { label: 'Best Chevrolet', homepage: '', specials_url: '' },
      { label: 'Supreme Chevrolet', homepage: '', specials_url: '' },
      { label: 'Matt Bowers Chevrolet', homepage: '', specials_url: '' },
    ],
  },
  {
    value: 'norm_reeves_ford',
    label: 'Norm Reeves Ford',
    dealer_id: 'norm_reeves_ford',
    group_name: 'norm_reeves',
    homepage: 'https://www.normreevesford.com',
    specials_url: 'https://www.normreevesford.com/new-vehicles/new-vehicle-specials/',
    competitors: [
      {
        label: 'Central Ford',
        homepage: 'https://www.centralfordla.net',
        specials_url: 'https://www.centralfordla.net/new-vehicles/new-vehicle-specials/',
      },
      {
        label: 'Ford of Long Beach',
        homepage: 'https://www.bpfordoflongbeach.com',
        specials_url: 'https://www.bpfordoflongbeach.com/specials/',
      },
      {
        label: 'Ken Grody Ford Buena Park',
        homepage: 'https://www.kengrodyfordorangecounty.com',
        specials_url: 'https://www.kengrodyfordorangecounty.com/new-vehicles/new-vehicle-specials/',
      },
    ],
  },
  {
    value: 'puente_hills_toyota',
    label: 'Puente Hills Toyota',
    dealer_id: 'puente_hills_toyota',
    group_name: 'Kaminsky Automotive',
    homepage: 'https://www.puentehillstoyota.com',
    specials_url: '',
    competitors: [
      { label: 'Longo Toyota', homepage: 'https://www.longotoyota.com', specials_url: '' },
      { label: 'Toyota of Whittier', homepage: 'https://www.toyotaofwhittier.com', specials_url: '' },
      { label: 'Toyota of West Covina', homepage: 'https://www.toyotawestcovina.com', specials_url: '' },
      { label: 'Claremont Toyota', homepage: 'https://www.claremonttoyota.com', specials_url: '' },
    ],
  },
];

export function getSpecialsStore(value) {
  return SPECIALS_STORES.find(s => s.value === value) || null;
}

// Build a flat list of dealer options for a store (client store first).
export function getDealerOptions(store) {
  if (!store) return [];
  return [
    { value: store.label, label: store.label, isClient: true },
    ...store.competitors.map(c => ({ value: c.label, label: c.label, isClient: false })),
  ];
}

// Find a competitor entry by name.
export function getCompetitorByName(store, name) {
  if (!store) return null;
  if (name === store.label) {
    return { label: store.label, homepage: store.homepage, specials_url: store.specials_url, isClient: true };
  }
  return store.competitors.find(c => c.label === name) || null;
}