export function PreviewBanner({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <div role="status" className="sticky top-0 z-[100] bg-primary px-4 py-2 text-center text-xs text-primary-foreground">
      Preview — these changes are not published yet. Close this tab and press "Save & publish" in Admin to make them live.
    </div>
  );
}
