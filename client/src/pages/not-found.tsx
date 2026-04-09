import { Link } from "wouter";
export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A]">
      <div className="text-center px-8">
        <p className="font-display font-black text-[8rem] leading-none text-white/[0.04] select-none">404</p>
        <h1 className="font-display font-black text-3xl uppercase tracking-wide text-white -mt-4">Page not found</h1>
        <div className="h-px w-12 bg-amber-500 mx-auto my-4" />
        <p className="text-neutral-500 text-sm mb-8">This page doesn't exist or you don't have access.</p>
        <Link href="/">
          <button className="bg-amber-500 hover:bg-amber-400 text-black font-display font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-sm transition-all">
            Back to dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
