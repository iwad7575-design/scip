import { ChatKitPanel } from "./components/ChatKitPanel";

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-100 dark:bg-slate-950 px-4 py-6">
      <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 h-screen max-h-screen">
        <Header />
        <div className="flex-1 min-h-0">
          <ChatKitPanel />
        </div>
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="flex-shrink-0 rounded-2xl bg-white dark:bg-slate-900 shadow-sm px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
          S
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              SHIFA Clinical Intelligence Platform
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              SCIP
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            AI-powered clinical decision support for healthcare providers in Ethiopia. Ask any clinical
            question — SCIP retrieves answers directly from validated national guidelines including the{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Standard Treatment Guidelines, National ANC Guideline (2022),
            </span>{" "}
            and{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              National Malaria Guidelines (2018)
            </span>
            . Every response includes source references so you can verify the evidence.
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Guideline-grounded answers
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Source citations with every response
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Designed for low-resource settings
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
