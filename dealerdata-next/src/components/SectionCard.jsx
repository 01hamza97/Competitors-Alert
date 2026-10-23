export default function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}