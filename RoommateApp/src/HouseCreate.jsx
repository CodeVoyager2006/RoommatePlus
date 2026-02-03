import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function HouseCreate() {
  const navigate = useNavigate();
  const [houseName, setHouseName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [houseId, setHouseId] = useState(null);

  function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function createHouse() {
    while (true) {
      const code = generateCode();

      const { data, error } = await supabase
        .from("households")
        .insert({ name: houseName, invite_code: code })
        .select()
        .single();

      if (!error) {
        setInviteCode(code);
        setHouseId(data.id);
        break;
      }
    }
  }

  async function continueToApp() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    await supabase
      .from("profiles")
      .update({ household_id: houseId })
      .eq("id", data.user.id);

    navigate("/app");
  }

  return (
    <div>
      {!inviteCode ? (
        <>
          <input placeholder="House Name" onChange={e => setHouseName(e.target.value)} />
          <button onClick={createHouse}>Create House</button>
        </>
      ) : (
        <>
          <p>Invite Code:</p>
          <pre>{inviteCode}</pre>
          <button onClick={continueToApp}>Continue</button>
        </>
      )}
    </div>
  );
}
