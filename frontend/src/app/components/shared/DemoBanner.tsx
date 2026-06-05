"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Slim top strip shown only for guest (anonymous) demo sessions. Makes the
 * read-only nature explicit and offers a path to a real account. Renders
 * nothing for normal authenticated users.
 *
 * Note: this is UX only — the actual read-only enforcement lives server-side
 * in the backend's requireAuth middleware (anonymous users get 403 on writes).
 */
export function DemoBanner() {
    const { isAnonymous } = useAuth();
    if (!isAnonymous) return null;

    return (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gray-900 px-4 py-2 text-center text-xs text-white sm:text-sm">
            <span>
                You&rsquo;re viewing a <strong>read-only demo</strong> — changes
                won&rsquo;t be saved.
            </span>
            <Link
                href="/signup"
                className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-900 transition-colors hover:bg-white/90"
            >
                Create a free account
            </Link>
        </div>
    );
}
