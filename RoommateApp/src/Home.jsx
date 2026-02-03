import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>RoommatesPlus</h1>

      <div style={styles.actions}>
        <button style={styles.button} onClick={() => navigate("/login")}>
          Log In
        </button>

        <button style={styles.button} onClick={() => navigate("/signup")}>
          Sign Up
        </button>
      </div>
    </main>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: "40px",
    fontSize: "2.5rem",
  },
  actions: {
    display: "flex",
    gap: "20px",
  },
  button: {
    padding: "12px 24px",
    fontSize: "1rem",
    cursor: "pointer",
  },
};
