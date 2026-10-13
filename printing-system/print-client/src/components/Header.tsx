import { PRINT_SERVER_URL } from "../lib/env";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Print Client</h1>
          <p className="text-xs text-slate-400">LAN printing, no accounts required</p>
        </div>
        <p className="hidden text-xs text-slate-400 sm:block">{PRINT_SERVER_URL}</p>
      </div>
    </header>
  );
}
