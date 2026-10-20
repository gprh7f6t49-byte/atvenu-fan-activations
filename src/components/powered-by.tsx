/** "Powered by atVenu" for artist-branded pages. The mark is drawn in the page's text colour (CSS mask), so it shows on light or dark artist themes. */
export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <a href="https://www.atvenu.com" target="_blank" rel="noopener"
      className={`relative z-10 mx-auto flex w-fit items-center gap-2 pb-8 text-xs opacity-50 transition hover:opacity-80 ${className}`}>
      Powered by
      <span aria-hidden className="inline-block h-3.5 w-4 bg-current"
        style={{ mask: "url(/brand/atvenu-mark-white.png) center / contain no-repeat", WebkitMask: "url(/brand/atvenu-mark-white.png) center / contain no-repeat" }} />
      <span className="font-semibold">atVenu</span>
    </a>
  );
}
