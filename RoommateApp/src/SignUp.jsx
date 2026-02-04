import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!displayName.trim()) {
      alert("Please enter a display name");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setLoading(false);
      return;
    }
    // Optional: Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    setLoading(false);
    navigate("/house-setup");
  }

  return (
    <div>
      <input placeholder="Display Name" onChange={e => setDisplayName(e.target.value)} disabled={loading} />
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} disabled={loading} />
      <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} disabled={loading} />
      <button onClick={handleSignUp} disabled={loading}>
        {loading ? "Signing Up..." : "Sign Up"}
      </button>
    </div>
  );
}
