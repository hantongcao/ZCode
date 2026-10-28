import xunguAppLogoUrl from "@/assets/xungu-app-logo.png";
import { cn } from "@/components/lib/utils.js";

export function ZCodeAboutLogo({ className }: { className?: string }) {
  return (
    <img
      src={xunguAppLogoUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("shrink-0 rounded-[4px] object-contain", className)}
    />
  );
}

export function ZCodeWordmarkLogo({ className }: { className?: string }) {
  return (
    <img
      src={xunguAppLogoUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("shrink-0 rounded-[4px] object-contain", className)}
    />
  );
}
