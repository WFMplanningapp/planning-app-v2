const Stepper = ({ step }) => {
  const steps = ["Upload Data", "Data Quality", "Configure", "Forecast Results"];

  const styles = {
    container: { display: "flex", gap: 0, marginBottom: "1.5rem", borderBottom: "2px solid #dbdbdb" },
    step: (active, done) => ({
      flex: 1, textAlign: "center", padding: "12px 8px", cursor: "default",
      borderBottom: `3px solid ${done ? "rgb(139,240,187)" : active ? "rgb(74,74,249)" : "transparent"}`,
      marginBottom: "-2px",
    }),
    num: (active, done) => ({
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 28, height: 28, borderRadius: "50%", fontWeight: 700, fontSize: "0.8rem", marginBottom: 4,
      background: done ? "rgb(139,240,187)" : active ? "rgb(74,74,249)" : "#f5f5f5",
      color: done ? "#09092d" : active ? "#fff" : "#999",
      border: `2px solid ${done ? "rgb(139,240,187)" : active ? "rgb(74,74,249)" : "#dbdbdb"}`,
    }),
    label: (active) => ({ display: "block", fontSize: "0.75rem", color: active ? "#363636" : "#999" }),
  };

  return (
    <div style={styles.container}>
      {steps.map((label, i) => {
        const n = i + 1, active = step === n, done = step > n;
        return (
          <div key={n} style={styles.step(active, done)}>
            <div style={styles.num(active, done)}>{done ? "✓" : n}</div>
            <span style={styles.label(active)}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;