import { useNavigate } from "react-router-dom";

export default function HouseSetup() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <button onClick={() => navigate("/house-create")}>
        Create a House
      </button>

      <button onClick={() => navigate("/house-login")}>
        Join with Code
      </button>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    justifyContent: "center",
    alignItems: "center",
  },
};
