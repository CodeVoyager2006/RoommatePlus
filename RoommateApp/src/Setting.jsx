import { React, useEffect } from "react";
import { supabaseClient } from "./config/supabaseClient";

export default function Setting(){
  useEffect(() => {
    console.log('Supabase Client:', supabaseClient);
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  }, []);

  return (
    <div>
      <h2>Settings</h2>
      <p>Settings and profile editing.</p>
    </div>
  );
}
