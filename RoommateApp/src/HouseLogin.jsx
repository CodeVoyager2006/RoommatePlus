import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function HouseLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  async function joinHouse() {
    const { data: house, error } = await supabase
      .from("households")
      .select("id")
      .eq("invite_code", code)
      .single();

    if (error) {
      alert("Invalid invite code");
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    await supabase
      .from("profiles")
      .update({ household_id: house.id })
      .eq("id", data.user.id);

    navigate("/app");
  }

  return (
    <div>
      <input onChange={e => setCode(e.target.value)} placeholder="Invite Code" />
      <button onClick={joinHouse}>Join</button>
    </div>
  );
}
