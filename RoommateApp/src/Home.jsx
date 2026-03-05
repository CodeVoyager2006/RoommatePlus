import { useNavigate } from "react-router-dom";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <h1 className="onboarding-wordmark">
          Roommates<span>Plus</span>
        </h1>
        <p className="onboarding-tagline">Your household, organised.</p>

        <div className="onboarding-actions">
          <button
            className="onboarding-btn onboarding-btn-primary"
            onClick={() => navigate("/login")}
          >
            Log In
          </button>
          <button
            className="onboarding-btn onboarding-btn-secondary"
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </button>
        </div>
      </div>
    </main>
  );
}