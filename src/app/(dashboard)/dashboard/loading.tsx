export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-44 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-[#e0e0e3] shadow-card h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card h-80 animate-pulse" />
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card h-80 animate-pulse" />
      </div>
    </div>
  )
}
