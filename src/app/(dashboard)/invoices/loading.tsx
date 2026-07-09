export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-36 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="h-10 bg-white rounded-lg border border-[#e0e0e3] animate-pulse" />
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card h-96 animate-pulse" />
    </div>
  )
}
