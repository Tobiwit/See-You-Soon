"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "@/lib/session";
import s from "./gate.module.css";

/** Everything shown before the private space is available. */
export function Gate() {
  const { state, signOutNow, retry } = useSession();

  if (state.status === "loading") {
    return (
      <main className={s.wrap} aria-busy="true">
        <p className={`display ${s.mark}`}>See You Soon</p>
        <p className={s.small}>Opening…</p>
      </main>
    );
  }

  if (state.status === "unconfigured") {
    return (
      <main className={s.wrap}>
        <p className={`display ${s.mark}`}>See You Soon</p>
        <div className={s.card}>
          <h1 className={s.h}>Almost there</h1>
          <p>
            This deployment has no Firebase project configured yet. Add the <code>NEXT_PUBLIC_FIREBASE_*</code>{" "}
            environment variables (see <code>README.md</code>) and redeploy.
          </p>
        </div>
      </main>
    );
  }

  if (state.status === "not-member") {
    return (
      <main className={s.wrap}>
        <p className={`display ${s.mark}`}>See You Soon</p>
        <div className={s.card}>
          <h1 className={s.h}>This space is private</h1>
          <p>
            <strong>{state.email}</strong> isn&apos;t one of the two accounts that can open it.
          </p>
          <button className="btn btn-block" onClick={() => void signOutNow()}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (state.status === "identity-error") {
    return (
      <main className={s.wrap}>
        <p className={`display ${s.mark}`}>See You Soon</p>
        <div className={s.card}>
          <h1 className={s.h}>Couldn&apos;t finish signing in</h1>
          <p className={s.err}>{state.message}</p>
          <div className={s.row}>
            <button className="btn btn-primary" onClick={retry}>
              Try again
            </button>
            <button className="btn" onClick={() => void signOutNow()}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <SignIn />;
}

function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
          ? "That email and password don't match."
          : code.includes("too-many-requests")
            ? "Too many attempts. Wait a minute and try again."
            : code.includes("network")
              ? "No connection. Signing in needs the internet once."
              : "Couldn't sign in. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <main className={s.wrap}>
      <div className={s.cover}>
        <p className="eyebrow">Vol. 01 · Vietnam · December</p>
        <h1 className={`display ${s.title}`}>
          See
          <br />
          You
          <br />
          Soon
        </h1>
        <p className={s.byline}>Alex + Toby</p>
      </div>
      <form className={s.form} onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy || !email || !password}>
          {busy && <span className="spinner" />}
          {busy ? "Opening…" : "Open"}
        </button>
        <p className={s.small}>Private — only Alex and Toby have accounts.</p>
      </form>
    </main>
  );
}
