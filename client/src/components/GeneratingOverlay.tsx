export default function GeneratingOverlay() {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="text-5xl mb-4 animate-bounce">🏥</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Generating Patient Scenario</h3>
        <p className="text-gray-600 mb-4">
          Our AI is creating a realistic patient based on your PDF content.
          This includes demographics, vitals, lab results, and a unique personality...
        </p>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-medical-blue rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
