type DemoModalProps = {
  onClose: () => void;
  onLoadSample: () => void;
  onEnterOwn: () => void;
};

export function DemoModal({ onClose, onLoadSample, onEnterOwn }: DemoModalProps) {
  return (
    <div
      className="demo-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="demo-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Hybrid race demo"
      >
        <header className="demo-modal__header">
          <div>
            <p className="eyebrow">Quick demo</p>
            <h2>How to use Ocht</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close demo"
          >
            ×
          </button>
        </header>
        <div className="demo-modal__steps">
          <article>
            <span>1</span>
            <strong>Enter your goal</strong>
            <p>Pick a target finish time and athlete level.</p>
          </article>
          <article>
            <span>2</span>
            <strong>Add race splits</strong>
            <p>Use run times and station times from a race or simulation.</p>
          </article>
          <article>
            <span>3</span>
            <strong>Read the report</strong>
            <p>Start with target path, strengths, leaks, and next action.</p>
          </article>
        </div>
        <div className="demo-modal__example" aria-label="Example split input">
          <div>
            <span>Target</span>
            <strong>1:20:00</strong>
          </div>
          <div>
            <span>Run 1</span>
            <strong>4:55</strong>
          </div>
          <div>
            <span>Sled push</span>
            <strong>5:45</strong>
          </div>
          <div>
            <span>Output</span>
            <strong>Find leaks</strong>
          </div>
        </div>
        <div className="demo-modal__actions">
          <button type="button" onClick={onLoadSample}>
            Load sample race
          </button>
          <button className="button-secondary" type="button" onClick={onEnterOwn}>
            I will enter my own
          </button>
        </div>
      </section>
    </div>
  );
}
