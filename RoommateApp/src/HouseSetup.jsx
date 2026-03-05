import { useNavigate } from "react-router-dom";
import "./Home.css";

export default function HouseSetup() {
  const navigate = useNavigate();

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <h2 className="onboarding-title">Set up your home</h2>
        <p className="onboarding-subtitle">
          Create a new household or join one with an invite code.
        </p>

        <div className="onboarding-option-grid">
          <button
            className="onboarding-option-card"
            onClick={() => navigate("/house-create")}
          >
            <div className="onboarding-option-icon">🏠</div>
            <div className="onboarding-option-text">
              <div className="onboarding-option-title">Create a house</div>
              <div className="onboarding-option-desc">
                Start fresh and invite your roommates
              </div>
            </div>
          </button>

          <button
            className="onboarding-option-card"
            onClick={() => navigate("/house-login")}
          >
            <div className="onboarding-option-icon">🔑</div>
            <div className="onboarding-option-text">
              <div className="onboarding-option-title">Join with a code</div>
              <div className="onboarding-option-desc">
                Enter an invite code from your roommate
              </div>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}