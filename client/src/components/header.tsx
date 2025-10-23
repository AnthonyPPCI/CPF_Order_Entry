import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./theme-toggle";
import { Phone, Mail } from "lucide-react";

export function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex flex-col hover-elevate rounded-md px-3 py-1 -ml-3" data-testid="link-home">
              <span className="text-lg font-bold text-foreground">CustomPictureFrames.com</span>
              <span className="text-xs text-muted-foreground hidden sm:block">6 Shirley Ave, Somerset, NJ 08873</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              <a href="tel:8009168770" className="flex items-center gap-1.5 hover-elevate rounded-md px-2 py-1">
                <Phone className="h-4 w-4" />
                <span className="font-mono">(800) 916-8770</span>
              </a>
              <a href="mailto:hello@CustomPictureFrames.com" className="flex items-center gap-1.5 hover-elevate rounded-md px-2 py-1">
                <Mail className="h-4 w-4" />
                <span>hello@CustomPictureFrames.com</span>
              </a>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex gap-1 border-t -mx-4 px-4 md:mx-0 md:px-0 md:border-t-0">
          <Link
            href="/"
            className={`px-4 py-3 text-sm font-medium transition-colors hover-elevate rounded-md ${
              location === "/" || location.startsWith("/order/")
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid="link-new-order"
          >
            New Order
          </Link>
          <Link
            href="/orders"
            className={`px-4 py-3 text-sm font-medium transition-colors hover-elevate rounded-md ${
              location === "/orders"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid="link-orders"
          >
            Order List
          </Link>
        </nav>
      </div>
    </header>
  );
}
