import { Binary, Fingerprint, LockKeyhole, PencilRuler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PixelPortrait } from '../components/PixelPortrait';
import { DataBlock } from '../components/ui';

export function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Robinhood Chain / 2,000 on-chain identities</p>
          <h1 id="hero-title">Loxleys</h1>
          <p className="hero-text">
            Immutable public portraits. One permanent outlaw identity.
          </p>
          <div className="hero-actions">
            <span className="shadow-button locked-action" aria-disabled="true" title="Agent tools will open after mint">
              Agent · Coming soon
              <LockKeyhole size={16} />
            </span>
            <Link className="ghost-button" to="/docs">
              Read protocol
            </Link>
          </div>
        </div>
        <PixelPortrait caption="Token #1 / sealed outlaw" />
      </section>

      <section className="workspace home-system">
        <div className="home-section-copy">
          <p className="section-kicker">01 / Double identity</p>
          <h2>Public by origin.<br />Outlaw by choice.</h2>
          <p>Every Loxley begins as an immutable 40×40 bitmap. After reveal, its owner or delegate may alter up to 256 pixels once, then seal the result forever.</p>
        </div>
        <div className="panel-grid">
          <DataBlock
            icon={Fingerprint}
            title="Public identity"
            text="The original portrait remains available and unchanged for the lifetime of the token."
          />
          <DataBlock
            icon={LockKeyhole}
            title="Outlaw identity"
            text="A single 1–256 pixel XOR overlay becomes the token's permanent rendered face."
          />
        </div>
      </section>

      <section className="home-architecture">
        <div className="home-section-copy">
          <p className="section-kicker">02 / Compact by design</p>
          <h2>Built on-chain.</h2>
        </div>
        <div className="architecture-list">
          <DataBlock icon={Binary} title="200 bytes" text="Each 1-bit portrait is packed into a compact bitmap and stored through SSTORE2." />
          <DataBlock icon={PencilRuler} title="1,600 pixels" text="A fixed 40×40 coordinate system keeps every identity readable and composable." />
          <DataBlock icon={Fingerprint} title="Owner-bound" text="Ownership controls mint-era identity, Canvas delegation, memories, and alliances. Traits determine capabilities." />
        </div>
      </section>

      <section className="home-cta">
        <p className="section-kicker">03 / Choose a path</p>
        <h2>Discover. Extend. Seal.</h2>
        <div className="hero-actions">
          <span className="shadow-button locked-action" aria-disabled="true">Agent · Coming soon <LockKeyhole size={16} /></span>
          <Link className="ghost-button" to="/canvas">Open Canvas</Link>
        </div>
      </section>
    </>
  );
}
