export default function Loading() {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "#0f110c",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "20px", zIndex: 9999,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap');
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes sweep {
          0%   { margin-left:-45%; width:45%; }
          50%  { margin-left:55%; width:45%; }
          100% { margin-left:100%; width:45%; }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>

      {/* Logo + ring */}
      <div style={{ position: "relative", width: 90, height: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: "linear-gradient(135deg, #576139 0%, #6a8854 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, fontFamily: "'Noto Sans Bengali', sans-serif", fontWeight: 700, color: "#0f110c",
          boxShadow: "0 0 40px rgba(143,168,90,0.35)",
        }}>শ</div>
        <div style={{
          position: "absolute", inset: 0,
          border: "2px solid #2a3320",
          borderTopColor: "#8fa85a",
          borderRightColor: "#6a8854",
          borderRadius: "50%",
          animation: "spin 1.3s linear infinite",
        }} />
      </div>

      {/* Title */}
      <div style={{
        fontFamily: "'Cinzel', serif", fontSize: "1.3rem",
        fontWeight: 700, letterSpacing: 3,
        color: "#8fa85a",
      }}>ShobdoNet</div>

      {/* Progress bar */}
      <div style={{ width: 200, height: 2, background: "#2a3320", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: "45%",
          background: "linear-gradient(90deg, #6b7e3e, #8fa85a)",
          borderRadius: 2,
          animation: "sweep 1.5s ease-in-out infinite",
        }} />
      </div>

      <div style={{
        fontFamily: "monospace", fontSize: "0.7rem",
        color: "#606848", letterSpacing: "1.5px",
        animation: "blink 1.8s ease-in-out infinite",
      }}>
        Loading Bengali Lexicon…
      </div>
    </div>
  );
}