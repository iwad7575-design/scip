export function ScipLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="SCIP logo"
        className="w-20 h-20 object-contain"
      />
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg font-bold text-slate-900">SHIFA Clinical Intelligence</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: "#1B3A6B" }}
          >
            SCIP
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          AI-powered clinical decision support · Ethiopia
        </p>
      </div>
    </div>
  );
}
