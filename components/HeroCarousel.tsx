/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';

// Imported rather than referenced by path, so the build reads each file's real
// dimensions and generates its own blur preview. These three were the heaviest
// thing the site served: 2.5MB of full-resolution PNG, set as CSS
// background-image, which no optimiser can reach and no browser can lazy-load.
// As <Image> they become AVIF/WebP at the width the device actually needs.
import carouselBabies from '@/public/images/carousel_babies.png';
import carouselMaternity from '@/public/images/carousel_maternity.png';
import carouselKids from '@/public/images/carousel_kids.png';

interface Slide {
  image: StaticImageData;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  bgColor: string;
}

const slides: Slide[] = [
  {
    image: carouselBabies,
    title: 'A World of Softness for Your Baby',
    subtitle: 'Organic cotton wear, cozy blankets and nursery essentials crafted for delicate skin.',
    buttonText: 'Shop Babies Collection',
    link: '/products?category=babies',
    bgColor: 'from-accent/15 to-background-secondary'
  },
  {
    image: carouselMaternity,
    title: 'Maternity Comfort & Chic Style',
    subtitle: 'Buttery-soft, elegant silhouettes designed to support and embrace you throughout motherhood.',
    buttonText: 'Explore Maternity Wear',
    link: '/products?category=maternity',
    bgColor: 'from-primary/15 to-background-secondary'
  },
  {
    image: carouselKids,
    title: 'Outfits Crafted for Playful Days',
    subtitle: 'Vibrant, durable clothing for active kids and pre-teens to run, jump and explore.',
    buttonText: 'Shop Kids & Pre-teens',
    link: '/products?category=kids',
    bgColor: 'from-info/15 to-background-secondary'
  }
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const prevSlide = () => {
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="relative w-full h-[520px] md:h-[520px] overflow-hidden bg-background-secondary border-b border-primary/10">
      {/* Slides Container */}
      <div className="w-full h-full relative">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              index === current ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Background Pastel Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${slide.bgColor} z-0`} />

            {/* One image element, not two.
                The layout used to hold a mobile copy and a desktop copy of the
                same photo and hide one with `md:hidden` / `hidden md:block`.
                As CSS backgrounds that was free — a background on a
                display:none element is never fetched. As <Image> it is not: a
                phone would download the desktop half-width crop it can never
                see. Absolute positioning gets the same two geometries out of a
                single element: a banner across the top 45% on mobile, the
                right half of the stage from md. */}
            <div className="absolute inset-x-0 top-0 h-[45%] md:inset-y-0 md:left-1/2 md:right-0 md:h-full z-10">
              <Image
                src={slide.image}
                alt=""
                fill
                // Only the first slide is on screen at load; the other two sit
                // behind an opacity transition and can wait. Marking all three
                // priority would have them race the one that is actually visible.
                priority={index === 0}
                placeholder="blur"
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>

            {/* Text: under the banner on mobile, the left half from md. */}
            <div className="absolute inset-x-0 bottom-0 h-[55%] md:inset-y-0 md:left-0 md:right-1/2 md:h-full flex items-center justify-center px-12 md:px-16 pb-8 pt-4 md:py-16 z-10">
              <div className="max-w-xl text-center md:text-left">
                <span className="inline-block px-3 py-1 mb-2 md:mb-4 bg-primary/10 text-primary text-caption-md md:text-body-sm font-semibold rounded-full tracking-wide shadow-elevation-1 uppercase">
                  New Arrival
                </span>
                <h1 className="text-h4 sm:text-h3 md:text-h1 font-black text-text-primary leading-tight tracking-tight mb-2 md:mb-4">
                  {slide.title}
                </h1>
                <p className="text-body-sm sm:text-body-md md:text-body-lg text-text-secondary mb-4 md:mb-8 font-medium">
                  {slide.subtitle}
                </p>
                <Link
                  href={slide.link}
                  className="inline-block bg-primary text-primary-foreground px-6 py-2.5 md:px-8 md:py-4 rounded-full font-bold hover:bg-primary-hover hover:scale-105 shadow-elevation-2 hover:shadow-elevation-3 transition-all text-body-sm md:text-body-md cursor-pointer"
                >
                  {slide.buttonText}
                </Link>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Slide Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-2 md:left-6 top-[22.5%] md:top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-surface/80 hover:bg-surface text-text-primary shadow-elevation-2 hover:shadow-elevation-3 transition-all cursor-pointer"
        aria-label="Previous Slide"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-2 md:right-6 top-[22.5%] md:top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-surface/80 hover:bg-surface text-text-primary shadow-elevation-2 hover:shadow-elevation-3 transition-all cursor-pointer"
        aria-label="Next Slide"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Slide Indicator Dots */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex space-x-2 md:space-x-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full transition-all cursor-pointer ${
              index === current ? 'bg-primary scale-125' : 'bg-disabled hover:bg-text-muted'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
