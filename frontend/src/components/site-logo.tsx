import Image from "next/image";
import Link from "next/link";

interface SiteLogoProps {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    animate?: boolean;
    asLink?: boolean;
}

export function SiteLogo({
    size = "md",
    className = "",
    animate = false,
    asLink = false,
}: SiteLogoProps) {
    const landingHref =
        process.env.NODE_ENV === "production"
            ? "https://lina.law"
            : "http://localhost:3000";
    const sizeClasses = {
        sm: "text-xl",
        md: "text-2xl",
        lg: "text-4xl",
        xl: "text-6xl",
    };

    const iconSizes = {
        sm: 20,
        md: 22,
        lg: 32,
        xl: 48,
    };

    const logo = (
        <h1
            className={`flex items-center gap-1.5 ${sizeClasses[size]} tracking-tight ${
                animate ? "sidebar-fade-in" : ""
            } ${className}`}
        >
            <Image
                src="/logos/symbol-black.png"
                alt=""
                width={iconSizes[size]}
                height={iconSizes[size]}
                className="shrink-0"
            />
            <span className="inline-flex items-baseline gap-1.5 leading-none">
                <span className="font-sans font-medium">Lina</span>
                <span
                    className="font-normal italic"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    OS
                </span>
            </span>
        </h1>
    );

    if (asLink) {
        return (
            <Link
                href={landingHref}
                className="cursor-pointer hover:opacity-80 transition-opacity"
            >
                {logo}
            </Link>
        );
    }

    return logo;
}
