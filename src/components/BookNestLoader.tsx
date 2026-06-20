type BookNestLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

export function BookNestLoader({ label = "Loading BookNest", fullScreen = false }: BookNestLoaderProps) {
  return (
    <div className={`booknest-loader ${fullScreen ? "min-h-screen" : "min-h-64"} flex items-center justify-center`}>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-fern text-3xl font-black text-white shadow-lg shadow-purple-500/25">
          B
        </div>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-ink/55">{label}</p>
      </div>
    </div>
  );
}
