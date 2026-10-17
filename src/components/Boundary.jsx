import React from "react";

/** Error boundary that catches render-time crashes in its subtree. */
export default class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Log to console for debugging; never surface component stacks to the user.
    // eslint-disable-next-line no-console
    console.error("Boundary caught:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <section className="ps-empty">
          <h1>Something went wrong on this screen</h1>
          <p className="lead">{String(this.state.error.message || this.state.error)}</p>
          <button
            className="ps-btn primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            {this.props.resetLabel || "Try again"}
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
