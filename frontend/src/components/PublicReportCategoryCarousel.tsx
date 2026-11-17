import { useEffect, useState } from 'react';

type IconKind = 'trafficCone' | 'light' | 'trash' | 'water';

const categories: { name: string; icon: IconKind }[] = [
    { name: 'Baches', icon: 'trafficCone' },
    { name: 'Alumbrado', icon: 'light' },
    { name: 'Limpieza', icon: 'trash' },
    { name: 'Saneamiento', icon: 'water' },
];

function CategoryIcon({ kind }: { kind: IconKind }) {
    return (
        <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            focusable="false"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {kind === 'trafficCone' && (
                <g transform="scale(2)" strokeWidth="1.25">
                    <path d="M16.05 10.966a5 2.5 0 0 1-8.1 0" />
                    <path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04" />
                    <path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z" />
                    <path d="M9.194 6.57a5 2.5 0 0 0 5.61 0" />
                </g>
            )}

            {kind === 'light' && (
                <>
                    <path d="M17 21a7 7 0 1 1 14 0c0 3-1.5 4.5-3 6.5-.8 1-1 2-1 3.5h-6c0-1.5-.2-2.5-1-3.5-1.5-2-3-3.5-3-6.5Z" />
                    <path d="M21 35h6M22 39h4M24 5v4M10 11l3 3M38 11l-3 3" />
                </>
            )}

            {kind === 'trash' && (
                <>
                    <path d="M6 12h36" />
                    <path d="M16 12V8h16v4" />
                    <path d="M38 12l-2 28H12L10 12" />
                    <path d="M20 22v12" />
                    <path d="M28 22v12" />
                </>
            )}

            {kind === 'water' && (
                <path d="M24 6C19 14 12 21 12 29a12 12 0 0 0 24 0c0-8-7-15-12-23Z" />
            )}
        </svg>
    );
}

export default function PublicReportCategoryCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % categories.length);
        }, 7000);

        return () => window.clearInterval(timer);
    }, []);

    const showPrevious = () => {
        setActiveIndex((current) => (current - 1 + categories.length) % categories.length);
    };

    const showNext = () => {
        setActiveIndex((current) => (current + 1) % categories.length);
    };

    const category = categories[activeIndex];

    return (
        <div className="public-home-category-carousel">
            <p className="public-home-category-label">Podés reportar:</p>

            <div className="public-home-category-row">
                <button
                    type="button"
                    className="public-home-category-arrow"
                    aria-label="Categoría anterior"
                    onClick={showPrevious}
                >
                    ‹
                </button>

                <div className="public-home-category-item" key={category.name}>
                    <CategoryIcon kind={category.icon} />
                    <span>{category.name}</span>
                </div>

                <button
                    type="button"
                    className="public-home-category-arrow"
                    aria-label="Categoría siguiente"
                    onClick={showNext}
                >
                    ›
                </button>
            </div>
        </div>
    );
}