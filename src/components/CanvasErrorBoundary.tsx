import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches failures inside the 3D canvas (most often: textures missing from public/textures). */
export class CanvasErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Globe failed to render:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="canvas-error" role="alert">
        <h2>The globe couldn’t load</h2>
        <p>
          Check that the texture files exist in <code>public/textures/</code> (see README), and that your
          browser supports WebGL.
        </p>
        <pre>{this.state.error.message}</pre>
      </div>
    );
  }
}
