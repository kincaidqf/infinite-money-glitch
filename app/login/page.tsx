import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In — Blackjack Counting Tutor",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <h1 className="login-page__title">Blackjack Counting Tutor</h1>
      <p className="login-page__subtitle">Sign in or create an account to track your progress.</p>
      <AuthForm />
    </main>
  );
}
