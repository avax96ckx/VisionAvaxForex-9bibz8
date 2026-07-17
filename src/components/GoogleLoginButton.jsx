import { FcGoogle } from "react-icons/fc";

export default function GoogleLoginButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        cursor: "pointer",
        fontSize: "16px",
        fontWeight: "600",
        transition: "0.3s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "#f5f5f5")}
      onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
    >
      <FcGoogle size={24} />
      Continue with Google
    </button>
  );
}
