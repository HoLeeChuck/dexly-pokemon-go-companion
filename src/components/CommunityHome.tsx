import { Icon } from './Icon';

const DISCORD_URL = 'https://discord.gg/9ZBN3EePRq';
const CAMPFIRE_URL = 'https://cmpf.re/QXGp7L';

export function CommunityHome({ onOpenDex }: { onOpenDex: () => void }) {
  return (
    <section className="page page--home">
      <header className="smna-hero">
        <div className="smna-hero__content">
          <span className="smna-kicker">Est. September 2, 2017 · Minneapolis, Minnesota</span>
          <span className="smna-mark" aria-hidden="true">
            SMNA
          </span>
          <h1>Play local. Meet neighbors. Catch together.</h1>
          <p>
            South Minneapolis Nokomis Area is a welcoming community of Pokémon GO players who
            coordinate raids, trades, friendship, meetups, and everyday adventures across the Twin
            Cities.
          </p>
          <div className="smna-hero__actions">
            <a
              className="button smna-button--discord"
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Join our Discord <Icon name="chevron-right" />
            </a>
            <a
              className="button smna-button--campfire"
              href={CAMPFIRE_URL}
              target="_blank"
              rel="noreferrer"
            >
              Find us on Campfire
            </a>
            <button className="button smna-button--dex" type="button" onClick={onOpenDex}>
              <Icon name="grid" /> Open Dex tracker
            </button>
          </div>
        </div>
        <div className="smna-hero__orbit" aria-hidden="true">
          <span>12.6K+</span>
          <small>local trainers</small>
          <i />
          <i />
          <i />
        </div>
      </header>

      <section className="smna-stats" aria-label="SMNA community at a glance">
        <article>
          <strong>12,600+</strong>
          <span>Campfire members</span>
        </article>
        <article>
          <strong>3,500+</strong>
          <span>Discord members</span>
        </article>
        <article>
          <strong>300+</strong>
          <span>gyms in our area</span>
        </article>
        <article>
          <strong>All welcome</strong>
          <span>neighbors and visitors</span>
        </article>
      </section>

      <section className="smna-section smna-welcome">
        <div className="smna-section__heading">
          <span>Welcome to SMNA</span>
          <h2>A community built around playing well with others.</h2>
          <p>
            What began as a raid-coordination server has grown into a huge network of friends and
            neighbors. We wait for trainers running a few minutes late, communicate before
            friendship level-ups, enjoy friendly gym competition, and make room for families.
          </p>
        </div>
        <div className="smna-values">
          <article>
            <span>01</span>
            <h3>Coordinate kindly</h3>
            <p>
              Use Discord or direct messages to confirm raids, trades, and friendship level-ups.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Play fairly</h3>
            <p>
              Follow Niantic and Discord terms. Don’t use SMNA to police or harass other players.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Keep it family-friendly</h3>
            <p>Discord members must be 13 or older, and text and voice channels stay welcoming.</p>
          </article>
        </div>
      </section>

      <section className="smna-section smna-start">
        <div className="smna-section__heading">
          <span>Your first five minutes</span>
          <h2>Get set up so trainers can find you.</h2>
        </div>
        <ol className="smna-checklist">
          <li>
            <i>
              <Icon name="user" />
            </i>
            <div>
              <strong>Match your nickname</strong>
              <p>Set your server nickname to your Pokémon GO trainer name.</p>
            </div>
          </li>
          <li>
            <i>
              <Icon name="heart" />
            </i>
            <div>
              <strong>Share your friend code</strong>
              <p>
                Post it in <b>#friend-codes</b>, with your trainer name when needed.
              </p>
            </div>
          </li>
          <li>
            <i>
              <Icon name="upload" />
            </i>
            <div>
              <strong>Unlock team and level roles</strong>
              <p>
                Post your trainer-page screenshot in <b>#level-up</b>.
              </p>
            </div>
          </li>
          <li>
            <i>
              <Icon name="shield" />
            </i>
            <div>
              <strong>Read the welcome guidance</strong>
              <p>Review community conduct and the local raid boundaries before posting.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="smna-area">
        <div className="smna-area__map" aria-hidden="true">
          <span className="smna-area__north">Lake Street</span>
          <span className="smna-area__west">Lyndale Ave</span>
          <span className="smna-area__east">Mississippi River</span>
          <span className="smna-area__south">66th Street</span>
          <i className="smna-area__lake">Lake Nokomis</i>
          <i className="smna-area__moa">Mall of America</i>
        </div>
        <div className="smna-area__copy">
          <span>Where we play</span>
          <h2>South Minneapolis, Nokomis, and nearby communities.</h2>
          <p>
            Our core area runs roughly from Lyndale Avenue to the Mississippi River and from Lake
            Street south to 66th Street in Richfield. Major meetup areas include Lake Nokomis,
            Minnehaha Falls, Powderhorn Park, Fort Snelling, and the Mall of America Community
            Ambassador campsite.
          </p>
          <div className="smna-raid-note">
            <Icon name="grid" />
            <p>
              <strong>Posting a raid?</strong> Use <b>#raids</b> inside these boundaries and{' '}
              <b>#raids-out-of-area</b> elsewhere.
            </p>
          </div>
        </div>
      </section>

      <section className="smna-section smna-resources">
        <div className="smna-section__heading">
          <span>Community links</span>
          <h2>Everything you need for the next adventure.</h2>
        </div>
        <div className="smna-link-grid">
          <a href={DISCORD_URL} target="_blank" rel="noreferrer">
            <strong>Discord</strong>
            <span>Chat, raids, trades, and friendship</span>
            <Icon name="chevron-right" />
          </a>
          <a href={CAMPFIRE_URL} target="_blank" rel="noreferrer">
            <strong>Campfire</strong>
            <span>Join the official SMNA community</span>
            <Icon name="chevron-right" />
          </a>
          <a href="https://smna.carrd.co/" target="_blank" rel="noreferrer">
            <strong>SMNA website</strong>
            <span>Meetups, tools, and community news</span>
            <Icon name="chevron-right" />
          </a>
          <a href="https://bit.ly/smna-nests" target="_blank" rel="noreferrer">
            <strong>Local nest map</strong>
            <span>Community-maintained nesting locations</span>
            <Icon name="chevron-right" />
          </a>
          <a href="https://pokemongo.com/map" target="_blank" rel="noreferrer">
            <strong>Community map</strong>
            <span>Explore official Ambassador meetups</span>
            <Icon name="chevron-right" />
          </a>
          <button type="button" onClick={onOpenDex}>
            <strong>Dex tracker</strong>
            <span>Track collections, trades, and searches</span>
            <Icon name="chevron-right" />
          </button>
        </div>
      </section>

      <footer className="smna-footer">
        <strong>South Minneapolis Nokomis Area Pokémon GO</strong>
        <p>
          All are welcome. This is an unofficial community tool and is not affiliated with Niantic,
          The Pokémon Company, or Discord.
        </p>
        <div>
          <a href="https://nianticlabs.com/terms/" target="_blank" rel="noreferrer">
            Niantic Terms
          </a>
          <a href="https://discord.com/terms" target="_blank" rel="noreferrer">
            Discord Terms
          </a>
        </div>
      </footer>
    </section>
  );
}
