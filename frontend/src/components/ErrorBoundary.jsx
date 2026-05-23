import { Component } from "react";

/**
 * Top-level error boundary. Catches render-time errors in descendants and
 * shows a friendly fallback instead of a blank screen.
 *
 * Note: React error boundaries do NOT catch errors inside event handlers or
 * async callbacks — only render/lifecycle/constructor errors.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "var(--clr-bg, #0b0b14)",
          color: "var(--clr-heading, #fff)",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: "2rem",
            borderRadius: 12,
            border: "1px solid var(--clr-border, #2a2a3e)",
            background: "var(--clr-surface, #15162a)",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p style={{ color: "var(--clr-muted, #8a8aa3)", fontSize: "0.9rem" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button className="btn btn-primary" onClick={this.handleReload} style={{ marginTop: "1rem" }}>
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
