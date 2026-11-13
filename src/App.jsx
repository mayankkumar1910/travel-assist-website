import { useEffect, useMemo, useState } from "react";

const categories = [
  { name: "All places", icon: "✳" },
  { name: "Mountains", icon: "⌁" },
  { name: "Beaches", icon: "≋" },
  { name: "Heritage", icon: "⌂" },
  { name: "Nature", icon: "♧" },
  { name: "Spiritual", icon: "☼" },
];

const destinations = [
  {
    name: "Valley of Flowers",
    region: "Uttarakhand, India",
    category: "Mountains",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85",
    alt: "Snow-capped Himalayan peaks above a green valley",
    duration: "5–7 days",
    note: "A little closer to the clouds",
  },
  {
    name: "The blue hour in Goa",
    region: "South Goa, India",
    category: "Beaches",
    image:
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1000&q=85",
    alt: "Tropical beach with palms and a calm blue sea",
    duration: "3–5 days",
    note: "Slow mornings, salt in your hair",
  },
  {
    name: "Old-world Udaipur",
    region: "Rajasthan, India",
    category: "Heritage",
    image:
      "https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=1000&q=85",
    alt: "Historic palace and architecture in Rajasthan",
    duration: "2–4 days",
    note: "Stories etched into every corner",
  },
  {
    name: "Into the wild",
    region: "Kaziranga, Assam",
    category: "Nature",
    image:
      "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1000&q=85",
    alt: "Sunlight streaming through a lush forest",
    duration: "3–4 days",
    note: "Let the forest set the pace",
  },
  {
    name: "A quieter Rishikesh",
    region: "Uttarakhand, India",
    category: "Spiritual",
    image:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=85",
    alt: "A person meditating in warm sunlight",
    duration: "2–3 days",
    note: "Breathe in. Let the noise go.",
  },
  {
    name: "High roads to Ladakh",
    region: "Ladakh, India",
    category: "Mountains",
    image:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1000&q=85",
    alt: "Dramatic mountain range beneath an open sky",
    duration: "7–10 days",
    note: "Take the long way around",
  },
];

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function AuthDialog({ initialMode, initialError, onClose, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(mode === "signup" ? { fullName } : {}),
          email,
          password,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Authentication failed. Please try again.");
      }

      onAuthenticated(result.user);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Unable to reach the sign-in service. Please try again shortly."
          : requestError.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="auth-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button
          className="auth-close"
          type="button"
          aria-label="Close sign-in dialog"
          onClick={onClose}
        >
          ×
        </button>
        <p className="eyebrow"><span className="eyebrow-line" />Your next chapter</p>
        <h2 id="auth-title">
          {mode === "signup" ? "Join us " : "Welcome "}
          <em>{mode === "signup" ? "elsewhere." : "back."}</em>
        </h2>
        <p className="auth-description">
          {mode === "signup"
            ? "Create an account to plan your next escape."
            : "Sign in to pick up right where you left off."}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Your name
              <input
                autoComplete="name"
                maxLength={80}
                name="fullName"
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>
          )}
          <label>
            Email address
            <input
              autoComplete="email"
              maxLength={254}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              maxLength={128}
              minLength={mode === "signup" ? 12 : undefined}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {mode === "signup" && (
              <span className="password-hint">Use at least 12 characters.</span>
            )}
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
            {!submitting && <ArrowIcon />}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New around here?"}{" "}
          <button
            type="button"
            onClick={() => changeMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}

function App() {
  const [activeCategory, setActiveCategory] = useState("All places");
  const [search, setSearch] = useState("");
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authDialogMode, setAuthDialogMode] = useState(null);
  const [authDialogError, setAuthDialogError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check the current sign-in.");
        const result = await response.json();
        setUser(result.user);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Could not check the current sign-in:", error);
        }
      });

    return () => controller.abort();
  }, []);

  const visibleDestinations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return destinations.filter((destination) => {
      const matchesCategory =
        activeCategory === "All places" ||
        destination.category === activeCategory;
      const matchesSearch =
        !query ||
        `${destination.name} ${destination.region} ${destination.category}`
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  function toggleSaved(name) {
    setSavedPlaces((current) =>
      current.includes(name)
        ? current.filter((place) => place !== name)
        : [...current, name],
    );
  }

  function explorePlaces(event) {
    event.preventDefault();
    document.getElementById("destinations")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  function openAuth(mode) {
    setAuthDialogError("");
    setAuthDialogMode(mode);
    setMenuOpen(false);
  }

  async function signOut() {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      setUser(null);
    } catch (error) {
      setAuthDialogError(error.message);
      setAuthDialogMode("signin");
      console.error("Could not sign out:", error);
    }
  }

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Elsewhere home">
          elsewhere<span className="wordmark-dot">.</span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"}>
          <a href="#destinations" onClick={() => setMenuOpen(false)}>
            Explore
          </a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)}>
            Our story
          </a>
          <a className="saved-link" href="#destinations" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true">♡</span> Saved
            {savedPlaces.length > 0 && (
              <span className="saved-count">{savedPlaces.length}</span>
            )}
          </a>
          <div className="auth-actions">
            {user ? (
              <>
                <span className="account-name">Hi, {user.fullName}</span>
                <button className="auth-open-button" type="button" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  className="auth-open-button"
                  type="button"
                  onClick={() => openAuth("signin")}
                >
                  Sign in
                </button>
                <button
                  className="auth-open-button is-primary"
                  type="button"
                  onClick={() => openAuth("signup")}
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-image" />
          <div className="hero-content">
            <p className="eyebrow hero-eyebrow">
              <span className="eyebrow-line" />
              A good place to begin
            </p>
            <h1 id="hero-title">
              Find your kind
              <br />
              of <em>elsewhere.</em>
            </h1>
            <p className="hero-copy">
              Mountain air, ocean days, old stories, quiet moments.
              <br className="desktop-break" /> Your next feeling is out there.
            </p>
            <form className="search-bar" onSubmit={explorePlaces}>
              <span className="search-icon" aria-hidden="true">⌕</span>
              <label className="visually-hidden" htmlFor="destination-search">
                Search by place or feeling
              </label>
              <input
                id="destination-search"
                type="search"
                placeholder="Where are you dreaming of?"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit">
                Find a place <ArrowIcon />
              </button>
            </form>
          </div>
          <div className="hero-caption">
            <span>01 / 04</span>
            <span className="caption-divider" />
            <span>Somewhere in the Western Ghats</span>
          </div>
          <a className="scroll-cue" href="#destinations">
            Scroll to wander <span aria-hidden="true">↓</span>
          </a>
        </section>

        <section className="discover section-wrap" id="destinations">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" />The feeling finder</p>
              <h2>What are you <em>in the mood for?</em></h2>
            </div>
            <p className="section-intro">
              Not just places to go. Little worlds to step into.
            </p>
          </div>

          <div className="category-list" role="group" aria-label="Filter destinations by category">
            {categories.map((category) => (
              <button
                className={
                  activeCategory === category.name
                    ? "category-chip is-active"
                    : "category-chip"
                }
                key={category.name}
                type="button"
                aria-pressed={activeCategory === category.name}
                onClick={() => setActiveCategory(category.name)}
              >
                <span aria-hidden="true">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>

          <div className="results-line" aria-live="polite">
            <span>
              {search ? `Places for “${search}”` : activeCategory === "All places" ? "A few places to fall for" : activeCategory}
            </span>
            <span>{visibleDestinations.length.toString().padStart(2, "0")} places</span>
          </div>

          {visibleDestinations.length > 0 ? (
            <div className="destination-grid">
              {visibleDestinations.map((destination, index) => {
                const isSaved = savedPlaces.includes(destination.name);
                return (
                  <article className="destination-card" key={destination.name}>
                    <a
                      className="card-image-link"
                      href="#how-it-works"
                      aria-label={`Learn more about ${destination.name}`}
                    >
                      <img
                        className="card-image"
                        src={destination.image}
                        alt={destination.alt}
                        loading={index > 2 ? "lazy" : "eager"}
                      />
                      <span className="card-category">{destination.category}</span>
                    </a>
                    <button
                      className={isSaved ? "save-button is-saved" : "save-button"}
                      type="button"
                      aria-label={isSaved ? `Remove ${destination.name} from saved places` : `Save ${destination.name}`}
                      aria-pressed={isSaved}
                      onClick={() => toggleSaved(destination.name)}
                    >
                      {isSaved ? "♥" : "♡"}
                    </button>
                    <div className="card-details">
                      <div className="card-location">{destination.region}</div>
                      <h3>{destination.name}</h3>
                      <div className="card-meta">
                        <span>{destination.note}</span>
                        <span>{destination.duration}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">✳</span>
              <h3>No places found just yet.</h3>
              <p>Try another search or choose a different feeling.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All places");
                }}
              >
                Show me everywhere <ArrowIcon />
              </button>
            </div>
          )}
        </section>

        <section className="interlude" id="how-it-works">
          <div className="interlude-image" role="img" aria-label="A quiet path through a sunlit landscape" />
          <div className="interlude-content">
            <p className="eyebrow"><span className="eyebrow-line" />A different kind of guide</p>
            <h2>Less itinerary.<br />More <em>in-the-moment.</em></h2>
            <p>
              We gather places around how you want to feel, so finding your next
              escape feels a little more like you.
            </p>
            <a href="#destinations" className="text-link">Find your feeling <ArrowIcon /></a>
          </div>
          <span className="interlude-note">Take the scenic route.</span>
        </section>

        <section className="closing section-wrap" id="about">
          <p className="eyebrow"><span className="eyebrow-line" />Your next chapter</p>
          <h2>Somewhere is<br />already <em>calling.</em></h2>
          <a href="#destinations" className="closing-link">Let’s find it <ArrowIcon /></a>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark" href="#">elsewhere<span className="wordmark-dot">.</span></a>
        <p>Go where you feel.</p>
        <span>Made for the way you wander · © 2025 Elsewhere</span>
      </footer>
      {authDialogMode && (
        <AuthDialog
          initialError={authDialogError}
          initialMode={authDialogMode}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            setAuthDialogError("");
            setAuthDialogMode(null);
          }}
          onClose={() => {
            setAuthDialogError("");
            setAuthDialogMode(null);
          }}
        />
      )}
    </>
  );
}

export default App;
