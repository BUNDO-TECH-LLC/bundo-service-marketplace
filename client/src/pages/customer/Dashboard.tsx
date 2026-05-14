import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import bundoLogo from '../../assets/BundoLogo.png';
import { api } from '../../lib/api';
import { resolveApiSession } from '../../lib/authSession';
import { auth } from '../../lib/firebase';
import type { ApiUser, Category, Offering } from '../../types';

const heroImage =
  'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1300&q=80';

const nigeriaStates = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'FCT',
];

const fallbackCategories = [
  { id: 'hair-stylist', name: 'Hair stylist', iconKey: 'HS' },
  { id: 'plumbing', name: 'Plumbing', iconKey: 'PL' },
  { id: 'cleaning', name: 'Cleaning', iconKey: 'CL' },
  { id: 'carpentry', name: 'Carpentry', iconKey: 'CP' },
  { id: 'photo', name: 'Photo', iconKey: 'PH' },
  { id: 'painter', name: 'Painter', iconKey: 'PA' },
  { id: 'courier', name: 'Courier', iconKey: 'CO' },
];

const fallbackRecommendations = [
  {
    id: 'jane-doe-1',
    name: 'Jane Doe',
    distance: '1.2km',
    tags: ['Plumbing', 'Pipe fitting'],
    rating: '4.0(89)',
    price: 'From $50',
  },
  {
    id: 'jane-doe-2',
    name: 'Jane Doe',
    distance: '1.2km',
    tags: ['Plumbing', 'Pipe fitting'],
    rating: '4.0(89)',
    price: 'From $50',
  },
  {
    id: 'jane-doe-3',
    name: 'Jane Doe',
    distance: '1.2km',
    tags: ['Plumbing', 'Pipe fitting'],
    rating: '4.0(89)',
    price: 'From $50',
  },
];

const pageClassName = 'min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]';
const headerClassName =
  'sticky top-0 z-20 grid min-h-24 grid-cols-[auto_auto_minmax(320px,1fr)_auto] items-center gap-7 bg-[var(--color-paper)] px-6 py-[18px] lg:px-[7vw] xl:px-28 max-[1180px]:grid-cols-1 max-[1180px]:gap-4 max-[720px]:min-h-0 max-[720px]:px-5 max-[720px]:py-4';
const brandClassName =
  'inline-flex items-center gap-3 bg-transparent p-0 text-[34px] leading-none font-black text-[var(--color-ink)] max-[720px]:text-[28px]';
const navClassName = 'flex flex-wrap justify-start gap-[18px]';
const navButtonClassName =
  'relative bg-transparent px-0 pt-2.5 pb-3.5 text-[15px] font-extrabold text-[var(--color-ink)] hover:text-[var(--color-accent-bright)]';
const activeNavButtonClassName = `${navButtonClassName} text-[var(--color-accent-bright)] after:absolute after:right-0 after:bottom-1 after:left-0 after:h-px after:bg-[var(--color-accent-bright)] after:content-['']`;
const topSearchClassName =
  'grid w-[min(100%,402px)] justify-self-end grid-cols-[minmax(170px,1fr)_minmax(150px,0.92fr)] items-center rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] max-[1180px]:w-full max-[1180px]:justify-self-stretch max-[720px]:grid-cols-1';
const topSearchFieldClassName =
  'flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:border-r first:border-[var(--color-line)] max-[720px]:first:border-r-0 max-[720px]:first:border-b';
const controlClassName = 'min-w-0 border-0 bg-transparent p-0 text-[var(--color-ink)] outline-none';
const iconTextClassName = 'text-2xl leading-none text-[var(--color-accent-bright)]';
const avatarClassName =
  'grid h-[26px] w-[26px] place-items-center rounded-full bg-linear-to-br from-[#163364] to-[#9da8ff] text-xs font-extrabold text-[var(--color-paper)]';
const mainClassName = 'px-6 pt-11 pb-24 lg:px-[7vw] xl:px-28 max-[720px]:px-5 max-[720px]:pt-8 max-[720px]:pb-16';
const heroClassName =
  'grid min-h-[642px] grid-cols-[minmax(430px,1fr)_minmax(430px,0.94fr)] items-center gap-[clamp(42px,7vw,84px)] max-[1180px]:grid-cols-1 max-[720px]:min-h-0 max-[720px]:gap-7';
const heroTitleClassName =
  'm-0 max-w-[560px] text-[50px] leading-[1.12] font-medium text-[var(--color-ink)] max-[720px]:text-[42px]';
const searchBoxClassName =
  'mt-6 w-[min(100%,596px)] rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-2 shadow-[0_4px_14px_var(--shadow-light)]';
const searchGridClassName = 'grid grid-cols-[minmax(180px,1fr)_minmax(168px,0.86fr)_120px] max-[720px]:grid-cols-1';
const searchFieldClassName =
  'flex min-h-12 min-w-0 items-center gap-2.5 border-r border-[var(--color-line)] px-3.5 max-[720px]:border-r-0 max-[720px]:border-b';
const primaryButtonClassName =
  'min-h-12 rounded-lg bg-[var(--color-accent-button)] px-[18px] text-base font-semibold text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)]';
const heroMediaClassName =
  'min-h-[650px] overflow-hidden rounded-[30px] bg-[var(--color-soft)] shadow-[0_22px_52px_var(--shadow-soft)] max-[720px]:min-h-[360px]';
const sectionHeadClassName = 'mb-8 flex items-center justify-between gap-5';
const sectionTitleClassName = 'm-0 text-[26px] font-medium text-[var(--color-ink)]';
const textButtonClassName = 'bg-transparent p-0 text-base font-medium text-[var(--color-accent-bright)] hover:text-[var(--color-accent-dark)]';
const categoriesClassName =
  'grid grid-cols-7 justify-between gap-[18px] max-[1180px]:grid-cols-4 max-[720px]:grid-cols-2';
const categoryButtonClassName =
  'grid min-h-[130px] place-items-center gap-3 rounded-[14px] bg-[#f7f5f5] px-3 py-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-dark)]';
const recommendedGridClassName = 'grid grid-cols-3 gap-3.5 max-[1180px]:grid-cols-1';
const cardClassName = 'grid gap-[18px] rounded-lg border border-[var(--color-input-border)] bg-[#fbfafa] p-2.5';
const cardHeadClassName = 'grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-4 max-[720px]:grid-cols-1';
const cardAvatarClassName = `${avatarClassName} h-16 w-16 text-2xl`;
const tagWrapClassName = 'flex flex-wrap gap-2';
const tagClassName = 'rounded-full bg-[var(--color-accent-wash)] px-2.5 py-[3px] text-xs text-[var(--color-accent-bright)]';
const metaClassName = 'grid grid-cols-[auto_auto_1fr] items-center gap-2.5 pl-20 max-[720px]:grid-cols-1 max-[720px]:pl-0';
const bookButtonClassName = 'min-h-14 rounded-[14px] bg-[#141414] font-semibold text-[var(--color-paper)] hover:bg-[var(--color-ink-panel)]';

function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}

function firstName(firebaseUser: User | null, me: ApiUser | null) {
  const displayName = firebaseUser?.displayName?.trim();

  if (displayName) {
    return displayName.split(' ')[0];
  }

  const email = firebaseUser?.email || me?.email;
  return email?.split('@')[0].split(/[._-]/)[0] || 'Ella';
}

type CustomerDashboardProps = {
  requireAuth?: boolean;
};

export default function CustomerDashboard({ requireAuth = true }: CustomerDashboardProps) {
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [me, setMe] = useState<ApiUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    if (!requireAuth) {
      setMe({
        firebaseUid: 'dev-customer',
        email: 'ella@example.com',
        phone: null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
      });
      return undefined;
    }

    if (!auth) {
      navigate('/login', { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const session = await resolveApiSession(user);

        if (session.user.role !== 'CUSTOMER') {
          navigate('/?view=workspace', { replace: true });
          return;
        }

        setFirebaseUser(user);
        setMe(session.user);
      } catch {
        navigate('/login', { replace: true });
      }
    });
  }, [navigate, requireAuth]);

  useEffect(() => {
    Promise.all([
      api<{ categories: Category[] }>('/categories'),
      api<{ offerings: Offering[] }>('/offerings?page=1&limit=12&sort=rating'),
    ])
      .then(([categoryRes, offeringRes]) => {
        setCategories(categoryRes.categories);
        setOfferings(offeringRes.offerings);
      })
      .catch(() => undefined);
  }, []);

  const visibleCategories = useMemo(
    () => (categories.length > 0 ? categories.slice(0, 7) : fallbackCategories),
    [categories]
  );

  const displayName = firstName(firebaseUser, me);
  const initial = displayName.slice(0, 1).toUpperCase();

  function openMarketplace() {
    navigate('/?view=marketplace');
  }

  function openWorkspace(section: 'bookings' | 'messages') {
    navigate(`/?view=workspace&section=${section}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openMarketplace();
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }
    navigate('/', { replace: true });
  }

  return (
    <div className={pageClassName}>
      <header className={headerClassName}>
        <button className={brandClassName} type="button" onClick={() => navigate('/customer/dashboard')}>
          <img className="h-[50px] w-[50px] rounded-lg object-cover" src={bundoLogo} alt="Bundo logo" />
          <span>Bundo</span>
        </button>

        <nav className={navClassName} aria-label="Customer navigation">
          <button className={activeNavButtonClassName} type="button">Dashboard</button>
          <button className={navButtonClassName} type="button" onClick={openMarketplace}>Categories</button>
          <button className={navButtonClassName} type="button" onClick={() => openWorkspace('bookings')}>Bookings</button>
          <button className={navButtonClassName} type="button" onClick={() => openWorkspace('messages')}>Messages</button>
        </nav>

        <form className={topSearchClassName} onSubmit={submitSearch}>
          <label className={topSearchFieldClassName}>
            <span className={iconTextClassName} aria-hidden="true">Q</span>
            <input
              className={controlClassName}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search for artisan"
              type="search"
              aria-label="Search for artisan"
            />
          </label>
          <label className={topSearchFieldClassName}>
            <span className={iconTextClassName} aria-hidden="true">O</span>
            <select
              className={`${controlClassName} font-bold`}
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value)}
              aria-label="Select location"
            >
              <option value="">Lagos, Nigeria</option>
              {nigeriaStates.map((state) => (
                <option key={state} value={state}>{state}, Nigeria</option>
              ))}
            </select>
          </label>
        </form>

        <div className="inline-flex items-center justify-end gap-3 whitespace-nowrap">
          <button
            className="grid h-8 w-8 place-items-center bg-transparent text-[22px] text-[var(--color-ink)]"
            type="button"
            onClick={() => navigate('/?view=workspace&section=notifications')}
            aria-label="Notifications"
          >
            !
          </button>
          <button className="inline-flex items-center gap-2 bg-transparent p-0 font-semibold text-[var(--color-ink)]" type="button" onClick={logout}>
            <span className={avatarClassName}>{initial}</span>
            <span>{displayName}</span>
            <span aria-hidden="true">v</span>
          </button>
        </div>
      </header>

      <main className={mainClassName}>
        <section className={heroClassName}>
          <div className="max-w-[600px]">
            <h1 className={heroTitleClassName}>Connect with Artisans who <span className="text-[var(--color-accent-bright)]">deliver.</span></h1>
            <form className={searchBoxClassName} onSubmit={submitSearch}>
              <div className={searchGridClassName}>
                <label className={searchFieldClassName}>
                  <span className={iconTextClassName} aria-hidden="true">Q</span>
                  <input
                    className={`${controlClassName} text-base font-medium`}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search for artisan..."
                    type="search"
                    aria-label="Search for artisan"
                  />
                </label>
                <label className={searchFieldClassName}>
                  <span className={iconTextClassName} aria-hidden="true">O</span>
                  <select
                    className={`${controlClassName} text-base font-medium`}
                    value={selectedState}
                    onChange={(event) => setSelectedState(event.target.value)}
                    aria-label="Select location"
                  >
                    <option value="">Lagos, Nigeria</option>
                    {nigeriaStates.map((state) => (
                      <option key={state} value={state}>{state}, Nigeria</option>
                    ))}
                  </select>
                </label>
                <button className={primaryButtonClassName} type="submit">Find Artisan</button>
              </div>
            </form>
          </div>

          <div className={heroMediaClassName}>
            <img className="h-[650px] w-full object-cover max-[720px]:h-[360px]" src={heroImage} alt="Artisan repairing a kitchen sink" />
          </div>
        </section>

        <section className="mt-[18px]">
          <div className={sectionHeadClassName}>
            <h2 className={sectionTitleClassName}>Categories</h2>
            <button className={textButtonClassName} type="button" onClick={openMarketplace}>View all categories</button>
          </div>
          <div className={categoriesClassName}>
            {visibleCategories.map((category) => (
              <button className={categoryButtonClassName} key={category.id} type="button" onClick={openMarketplace}>
                <span className="text-[28px] font-black text-[var(--color-accent-button)]">{category.iconKey || category.name.slice(0, 2).toUpperCase()}</span>
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className={sectionHeadClassName}>
            <h2 className={sectionTitleClassName}>Recommended</h2>
            <button className={textButtonClassName} type="button" onClick={openMarketplace}>Browse artisans</button>
          </div>
          <div className={recommendedGridClassName}>
            {offerings.length > 0
              ? offerings.slice(0, 3).map((offering) => (
                  <article className={cardClassName} key={offering.id}>
                    <div className={cardHeadClassName}>
                      <span className={cardAvatarClassName}>
                        {(offering.artisan?.displayName || offering.title).slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h3 className="my-1.5 text-[21px] font-medium text-[var(--color-ink)]">{offering.artisan?.displayName || 'Approved artisan'}</h3>
                        <div className={tagWrapClassName}>
                          <span className={tagClassName}>{offering.category?.name || 'Service'}</span>
                          <span className={tagClassName}>{offering.title}</span>
                        </div>
                      </div>
                      <small className="mt-3 text-sm text-[var(--color-ink)]">{offering.artisan?.area || offering.artisan?.city || 'Nearby'}</small>
                    </div>
                    <div className={metaClassName}>
                      <span className="tracking-[1px] text-[#ee9952]">*****</span>
                      <span>{offering.artisan?.avgRating || '4.0'}({offering.artisan?.ratingCount || 0})</span>
                      <strong className="justify-self-end text-[21px] font-medium text-[var(--color-ink)] max-[720px]:justify-self-start">From {money(offering.priceFrom)}</strong>
                    </div>
                    <button className={bookButtonClassName} type="button" onClick={openMarketplace}>Book</button>
                  </article>
                ))
              : fallbackRecommendations.map((artisan) => (
                  <article className={cardClassName} key={artisan.id}>
                    <div className={cardHeadClassName}>
                      <span className={cardAvatarClassName}>{artisan.name.slice(0, 1)}</span>
                      <div>
                        <h3 className="my-1.5 text-[21px] font-medium text-[var(--color-ink)]">{artisan.name}</h3>
                        <div className={tagWrapClassName}>
                          {artisan.tags.map((tag) => <span className={tagClassName} key={tag}>{tag}</span>)}
                        </div>
                      </div>
                      <small className="mt-3 text-sm text-[var(--color-ink)]">{artisan.distance}</small>
                    </div>
                    <div className={metaClassName}>
                      <span className="tracking-[1px] text-[#ee9952]">*****</span>
                      <span>{artisan.rating}</span>
                      <strong className="justify-self-end text-[21px] font-medium text-[var(--color-ink)] max-[720px]:justify-self-start">{artisan.price}</strong>
                    </div>
                    <button className={bookButtonClassName} type="button" onClick={openMarketplace}>Book</button>
                  </article>
                ))}
          </div>
        </section>
      </main>
    </div>
  );
}
