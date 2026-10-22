import type { ReactNode } from "react";

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay">
      <div className="modal card">
        <div className="row">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="secondary" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
