import { useDealer } from '@/lib/DealerContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users } from 'lucide-react';

export default function DealerSelector() {
  const dealer = useDealer();
  
  if (!dealer) return null;
  
  const { groups, stores, selectedId, selectedType, select } = dealer;

  const currentValue = selectedId ? `${selectedType}::${selectedId}` : '';

  const handleSelect = (val) => {
    const [type, id] = val.split('::');
    select(type, id);
  };

  return (
    <Select value={currentValue} onValueChange={handleSelect}>
      <SelectTrigger className="w-56 h-8 text-sm bg-slate-800 border-slate-600 text-white focus:ring-0 focus:ring-offset-0">
        <SelectValue placeholder="Select dealership…" />
      </SelectTrigger>
      <SelectContent>
        {groups.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Groups</div>
            {groups.map(g => (
              <SelectItem key={g.id} value={`group::${g.id}`}>
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-blue-500 shrink-0" />
                  {g.name}
                </div>
              </SelectItem>
            ))}
          </>
        )}
        {stores.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Individual Stores</div>
            {stores.map(s => (
              <SelectItem key={s.id} value={`store::${s.id}`}>
                <div className="flex items-center gap-2">
                  <Building2 size={13} className="text-gray-400 shrink-0" />
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}