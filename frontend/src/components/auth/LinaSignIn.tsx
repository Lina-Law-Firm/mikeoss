"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/app/lib/mikeApi";
import { ShaderAnimation } from "@/components/ui/shader-animation";
import {
    GoogleGlyph,
    KeyGlyph,
    MicrosoftGlyph,
    OktaGlyph,
} from "@/components/auth/auth-glyphs";

/* Light "originui" auth styling mapped onto mikeoss's warm paper/ink palette
   (its globals.css remaps Tailwind's gray/black/white scales to lina's exact
   tokens, so these standard utilities resolve to the same colours lina uses). */
const FIELD =
    "flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm shadow-black/5 transition-shadow placeholder:text-gray-400 focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gray-900/15 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
    "inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gray-900 px-4 text-sm font-medium text-white shadow-sm shadow-black/5 transition-colors hover:bg-gray-900/90 disabled:pointer-events-none disabled:opacity-50";
const OUTLINE_BTN =
    "inline-flex h-10 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 shadow-sm shadow-black/5 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50";

function Spinner({ size = 12 }: { size?: number }) {
    return (
        <span
            style={{ width: size, height: size }}
            className="inline-block animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-900"
            aria-hidden="true"
        />
    );
}

const PROVIDERS = [
    {
        id: "google-ws",
        name: "Google Workspace",
        sub: "OAuth · SAML",
        glyph: <GoogleGlyph />,
    },
    {
        id: "ms-365",
        name: "Microsoft 365",
        sub: "Entra ID · OAuth",
        glyph: <MicrosoftGlyph />,
    },
    { id: "okta", name: "Okta", sub: "SAML · OIDC", glyph: <OktaGlyph /> },
    {
        id: "saml",
        name: "Other SAML / OIDC",
        sub: "Enter metadata",
        glyph: <KeyGlyph />,
    },
];

type View = "choice" | "custom-provider";

interface LinaSignInProps {
    mode?: "signin" | "signup";
}

/**
 * Split sign-in surface ported from lina-os-front's Screen1_SignIn: dark
 * WebGL-shader hero on the left, light auth card on the right. Wired to
 * mikeoss's Supabase + AuthContext (email/password + Google OAuth); the
 * SSO provider picker is a visual affordance (SAML/OIDC isn't wired yet).
 */
export function LinaSignIn({ mode = "signin" }: LinaSignInProps) {
    const isSignup = mode === "signup";
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();

    const [view, setView] = useState<View>("choice");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [organisation, setOrganisation] = useState("");
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ssoNote, setSsoNote] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!authLoading && isAuthenticated && !success) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router, success]);

    async function signInWithEmail() {
        if (pending) return;
        setPending("email");
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        if (signInError) {
            setError("Those credentials didn't match. Please try again.");
            setPending(null);
            return;
        }
        router.push("/assistant");
    }

    async function signUpWithEmail() {
        if (pending) return;
        setError(null);
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        setPending("email");
        const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
        });
        if (signUpError) {
            setError(signUpError.message);
            setPending(null);
            return;
        }
        if (data.session) {
            const trimmedName = name.trim();
            const trimmedOrg = organisation.trim();
            if (trimmedName || trimmedOrg) {
                try {
                    await updateUserProfile({
                        ...(trimmedName && { displayName: trimmedName }),
                        ...(trimmedOrg && { organisation: trimmedOrg }),
                    });
                } catch (profileError) {
                    console.error(
                        "[signup] failed to persist profile fields",
                        profileError,
                    );
                }
            }
        }
        setSuccess(true);
        setTimeout(() => router.push("/assistant"), 2000);
    }

    const submitEmail = () =>
        isSignup ? signUpWithEmail() : signInWithEmail();

    async function goGoogle() {
        if (pending) return;
        setPending("google");
        setError(null);
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/assistant` },
        });
        if (oauthError) {
            setError(oauthError.message);
            setPending(null);
        }
        // On success the browser is redirected to Google; no push here.
    }

    async function goGuest() {
        if (pending) return;
        setPending("guest");
        setError(null);
        // Anonymous sign-in gives a real (guest) Supabase session, so the
        // backend's JWT auth still works — but it's flagged read-only there.
        const { error: guestError } = await supabase.auth.signInAnonymously();
        if (guestError) {
            setError(
                "The demo is unavailable right now. Please try again, or sign in with your account.",
            );
            setPending(null);
            return;
        }
        router.push("/assistant");
    }

    function pickProvider() {
        // mikeoss isn't wired for SAML/OIDC SSO yet — surface that honestly
        // rather than faking a sign-in.
        setSsoNote(
            "Single sign-on isn't configured for this workspace yet. Use your email or Google to continue.",
        );
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    return (
        <div className="flex min-h-dvh flex-col bg-[#F0EDE6]">
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
                {/* Left: dark WebGL shader hero carrying the Lina OS wordmark
                    + editorial copy. Stacks above the card on mobile. */}
                <section className="relative flex flex-col overflow-hidden border-b border-black bg-[#0A0908] px-6 py-[clamp(1.25rem,4vh,3.5rem)] sm:px-10 md:border-b-0 md:border-r md:px-14">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0"
                    >
                        <ShaderAnimation className="size-full" />
                    </div>

                    {/* Brand lock — pixel-matched to the marketing header. */}
                    <span
                        className="relative z-10 inline-flex items-baseline gap-1.5 self-start"
                        aria-label="Lina OS"
                    >
                        <span className="font-sans text-[26px] font-medium leading-none tracking-tight text-white">
                            Lina
                        </span>
                        <span
                            className="text-[26px] font-normal italic leading-none tracking-tight text-white"
                            style={{
                                fontFamily: 'Georgia, "Times New Roman", serif',
                            }}
                        >
                            OS
                        </span>
                    </span>

                    <div className="relative z-10 flex flex-1 flex-col justify-center pt-12">
                        <h1 className="m-0 mb-4 text-balance text-[clamp(42px,4.4vw,64px)] font-light leading-[1.04] -tracking-wide text-white">
                            Welcome to Lina.
                        </h1>
                        <p className="m-0 max-w-[480px] text-[19px] leading-[1.55] text-white/80">
                            Sign in with a Lina account, or bring your own
                            domain.
                        </p>
                    </div>
                </section>

                {/* Right: auth card on warm paper. */}
                <section className="flex flex-col justify-center bg-[#F0EDE6] px-6 py-[clamp(1.25rem,4vh,3.5rem)] sm:px-10 md:px-14">
                    <div className="mx-auto w-full max-w-[400px] rounded-xl border border-gray-200 bg-white p-6 shadow-lg shadow-black/5 sm:p-7">
                        {success ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                </div>
                                <h2 className="m-0 text-lg font-semibold tracking-tight text-gray-900">
                                    Account created!
                                </h2>
                                <p className="m-0 text-sm text-gray-500">
                                    Redirecting you to the home page…
                                </p>
                            </div>
                        ) : view === "custom-provider" ? (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView("choice");
                                        setPending(null);
                                        setSsoNote(null);
                                    }}
                                    className="mb-4 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-sm text-gray-500 transition-colors hover:text-gray-900"
                                >
                                    <span aria-hidden>←</span> Back
                                </button>
                                <h2 className="m-0 text-lg font-semibold tracking-tight text-gray-900">
                                    Which provider hosts it?
                                </h2>
                                <p className="m-0 mt-1 text-sm text-gray-500">
                                    Routing{" "}
                                    <code className="font-mono text-[12.5px] text-gray-900">
                                        {(email.split("@")[1] || "your firm").trim()}
                                    </code>{" "}
                                    — pick the identity provider you use.
                                </p>
                                <div className="mt-4 flex flex-col gap-2">
                                    {PROVIDERS.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={pickProvider}
                                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm shadow-black/5 transition-colors hover:bg-gray-100"
                                        >
                                            <span className="inline-flex size-5 shrink-0 items-center justify-center">
                                                {p.glyph}
                                            </span>
                                            <span className="flex flex-1 flex-col">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {p.name}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {p.sub}
                                                </span>
                                            </span>
                                            <span
                                                aria-hidden
                                                className="text-gray-400"
                                            >
                                                →
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {ssoNote && (
                                    <p className="m-0 mt-4 text-sm text-gray-500">
                                        {ssoNote}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Header: symbol + title + description. */}
                                <div className="flex flex-col items-center gap-2">
                                    <Image
                                        src="/logos/symbol-black.png"
                                        alt="Lina"
                                        width={44}
                                        height={44}
                                        priority
                                        className="size-11 shrink-0"
                                    />
                                    <div className="flex flex-col gap-1 text-center">
                                        <h2 className="m-0 text-lg font-semibold tracking-tight text-gray-900">
                                            {isSignup
                                                ? "Create your account"
                                                : "Sign in"}
                                        </h2>
                                        <p className="m-0 text-sm text-gray-500">
                                            {isSignup
                                                ? "Set up your Lina OS sign-in to continue."
                                                : "Enter your credentials to access your account."}
                                        </p>
                                    </div>
                                </div>

                                <form
                                    className="mt-5 space-y-5"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        submitEmail();
                                    }}
                                >
                                    <div className="space-y-4">
                                        {isSignup && (
                                            <>
                                                <div className="space-y-2">
                                                    <label
                                                        htmlFor="signup-name"
                                                        className="block text-sm font-medium text-gray-900"
                                                    >
                                                        Name{" "}
                                                        <span className="font-normal text-gray-400">
                                                            (optional)
                                                        </span>
                                                    </label>
                                                    <input
                                                        id="signup-name"
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) =>
                                                            setName(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Your name"
                                                        className={FIELD}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label
                                                        htmlFor="signup-org"
                                                        className="block text-sm font-medium text-gray-900"
                                                    >
                                                        Organisation{" "}
                                                        <span className="font-normal text-gray-400">
                                                            (optional)
                                                        </span>
                                                    </label>
                                                    <input
                                                        id="signup-org"
                                                        type="text"
                                                        value={organisation}
                                                        onChange={(e) =>
                                                            setOrganisation(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Your organisation"
                                                        className={FIELD}
                                                    />
                                                </div>
                                            </>
                                        )}
                                        <div className="space-y-2">
                                            <label
                                                htmlFor="signin-email"
                                                className="block text-sm font-medium text-gray-900"
                                            >
                                                Email
                                            </label>
                                            <input
                                                id="signin-email"
                                                type="email"
                                                autoFocus={!isSignup}
                                                autoComplete="username"
                                                value={email}
                                                onChange={(e) =>
                                                    setEmail(e.target.value)
                                                }
                                                placeholder="you@firm.eu"
                                                className={FIELD}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label
                                                htmlFor="signin-password"
                                                className="block text-sm font-medium text-gray-900"
                                            >
                                                Password
                                            </label>
                                            <input
                                                id="signin-password"
                                                type="password"
                                                autoComplete={
                                                    isSignup
                                                        ? "new-password"
                                                        : "current-password"
                                                }
                                                value={password}
                                                onChange={(e) =>
                                                    setPassword(e.target.value)
                                                }
                                                placeholder={
                                                    isSignup
                                                        ? "Create a password"
                                                        : "Enter your password"
                                                }
                                                className={FIELD}
                                            />
                                        </div>
                                        {isSignup && (
                                            <div className="space-y-2">
                                                <label
                                                    htmlFor="signup-confirm"
                                                    className="block text-sm font-medium text-gray-900"
                                                >
                                                    Confirm password
                                                </label>
                                                <input
                                                    id="signup-confirm"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    value={confirmPassword}
                                                    onChange={(e) =>
                                                        setConfirmPassword(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Confirm your password"
                                                    className={FIELD}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {error && (
                                        <p className="m-0 text-sm text-[#6b1a22]">
                                            {error}
                                        </p>
                                    )}

                                    {!isSignup && (
                                        <div className="flex items-center justify-between gap-2">
                                            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-gray-500">
                                                <input
                                                    type="checkbox"
                                                    className="size-4 rounded border-gray-200 accent-gray-900"
                                                />
                                                Remember me
                                            </label>
                                            <a
                                                href="#"
                                                className="text-sm text-gray-700 underline underline-offset-2 hover:no-underline"
                                            >
                                                Forgot password?
                                            </a>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={
                                            !!pending ||
                                            !emailValid ||
                                            password.length <
                                                (isSignup ? 6 : 1)
                                        }
                                        className={PRIMARY_BTN}
                                    >
                                        {pending === "email" ? (
                                            <Spinner />
                                        ) : isSignup ? (
                                            "Create account"
                                        ) : (
                                            "Sign in"
                                        )}
                                    </button>
                                </form>

                                {/* Or divider */}
                                <div className="my-5 flex items-center gap-3 before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200">
                                    <span className="text-xs text-gray-500">
                                        Or
                                    </span>
                                </div>

                                {/* Google OAuth */}
                                <button
                                    type="button"
                                    onClick={goGoogle}
                                    disabled={!!pending}
                                    className={OUTLINE_BTN}
                                >
                                    {pending === "google" ? (
                                        <Spinner />
                                    ) : (
                                        <>
                                            <GoogleGlyph />{" "}
                                            {isSignup
                                                ? "Sign up with Google"
                                                : "Login with Google"}
                                        </>
                                    )}
                                </button>

                                {/* Guest / demo access — no account needed */}
                                <button
                                    type="button"
                                    onClick={goGuest}
                                    disabled={!!pending}
                                    className={`${OUTLINE_BTN} mt-3`}
                                >
                                    {pending === "guest" ? (
                                        <Spinner />
                                    ) : (
                                        "View demo — no account needed"
                                    )}
                                </button>

                                {/* Secondary links */}
                                <div className="mt-5 flex flex-col items-center gap-2 text-center text-sm">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setView("custom-provider")
                                        }
                                        className="cursor-pointer border-0 bg-transparent p-0 text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-900 hover:no-underline"
                                    >
                                        Use your firm&rsquo;s SSO
                                    </button>
                                    {isSignup ? (
                                        <Link
                                            href="/login"
                                            className="text-gray-500 underline underline-offset-2 hover:no-underline"
                                        >
                                            Already have an account? Log in
                                        </Link>
                                    ) : (
                                        <Link
                                            href="/signup"
                                            className="text-gray-500 underline underline-offset-2 hover:no-underline"
                                        >
                                            Don&rsquo;t have an account? Sign up
                                        </Link>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* mikeoss legal / demo notices (kept under the card). */}
                    {!success && (
                        <div className="mx-auto mt-4 w-full max-w-[400px] space-y-3 text-center">
                            {isSignup && (
                                <p className="text-xs text-gray-500">
                                    By signing up, you agree to our{" "}
                                    <Link
                                        href="https://mikeoss.com/terms"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-2 hover:no-underline"
                                    >
                                        Terms of Use
                                    </Link>{" "}
                                    and{" "}
                                    <Link
                                        href="https://mikeoss.com/privacy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-2 hover:no-underline"
                                    >
                                        Privacy Policy
                                    </Link>
                                    .
                                </p>
                            )}
                            <p className="text-xs leading-relaxed text-gray-500">
                                Lina OS is currently a demo service. Please do
                                not upload, submit, or store sensitive,
                                confidential, privileged, client, or personally
                                identifiable documents.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
