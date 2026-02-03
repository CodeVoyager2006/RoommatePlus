import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function handleSignUp() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const user = data.user;
    if (!user) return;

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: displayName,
        points: 0,
        streaks: 0,
        household_id: null,
      });

    if (profileError) {
      alert(profileError.message);
      return;
    }

    navigate("/house-setup");
  }

  return (
    <div>
      <input placeholder="Display Name" onChange={e => setDisplayName(e.target.value)} />
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleSignUp}>Sign Up</button>
    </div>
  );
}
