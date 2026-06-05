import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// lina-os-front uses a single sans-serif (Inter) across every type slot,
// including the serif slot — see globals.css `--font-serif`.
const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: new URL("https://app.mikeoss.com"),
    title: "Lina OS - AI Legal Platform",
    description:
        "AI-powered legal document analysis and contract review platform.",
    icons: {
        icon: [
            { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon.ico", sizes: "any" },
        ],
        shortcut: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        url: "https://app.mikeoss.com",
        siteName: "Lina OS",
        title: "Lina OS - AI Legal Platform",
        description:
            "AI-powered legal document analysis and contract review platform.",
        images: [
            {
                url: "/link-image.jpg",
                width: 1200,
                height: 651,
                alt: "Lina OS",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Lina OS - AI Legal Platform",
        description:
            "AI-powered legal document analysis and contract review platform.",
        images: ["/link-image.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${inter.variable} font-sans antialiased`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
