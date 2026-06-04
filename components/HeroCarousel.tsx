'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Slide {
  image: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  bgColor: string;
}

const slides: Slide[] = [
  {
    image: '/images/carousel_babies.png',
    title: 'A World of Softness for Your Baby',
    subtitle: 'Organic cotton wear, cozy blankets, and nursery essentials crafted for delicate skin.',
    buttonText: 'Shop Babies Collection',
    link: '/products?category=babies',
    bgColor: 'from-amber-100 to-orange-50'
  },
  {
    image: '/images/carousel_maternity.png',
    title: 'Maternity Comfort & Chic Style',
    subtitle: 'Buttery-soft, elegant silhouettes designed to support and embrace you throughout motherhood.',
    buttonText: 'Explore Maternity Wear',
    link: '/products?category=maternity',
    bgColor: 'from-pink-100 to-purple-50'
  },
  {
    image: '/images/carousel_kids.png',
    title: 'Outfits Crafted for Playful Days',
    subtitle: 'Vibrant, durable clothing for active kids and pre-teens to run, jump, and explore.',
    buttonText: 'Shop Kids & Pre-Teens',
    link: '/products?category=kids',
    bgColor: 'from-blue-100 to-teal-50'
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
    <div className="relative w-full h-[360px] md:h-[520px] overflow-hidden bg-gray-50 border-b border-pink-100">
      {/* Slides Container */}
      <div className="w-full h-full relative">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out flex flex-col md:flex-row items-center ${
              index === current ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Background Pastel Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${slide.bgColor} z-0`} />

            {/* Left Column: Text Content */}
            <div className="w-full md:w-1/2 h-full flex items-center justify-center p-6 md:p-16 relative z-10">
              <div className="max-w-xl text-center md:text-left">
                <span className="inline-block px-3 py-1 mb-3 md:mb-4 bg-pink-100 text-pink-700 text-xs md:text-sm font-semibold rounded-full tracking-wide shadow-sm uppercase">
                  New Arrival
                </span>
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-gray-900 leading-tight tracking-tight mb-3 md:mb-4">
                  {slide.title}
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-gray-700 mb-6 md:mb-8 font-medium">
                  {slide.subtitle}
                </p>
                <Link
                  href={slide.link}
                  className="inline-block bg-pink-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-bold hover:bg-pink-700 hover:scale-105 shadow-md hover:shadow-lg transition-all text-sm md:text-base cursor-pointer"
                >
                  {slide.buttonText}
                </Link>
              </div>
            </div>

            {/* Right Column: Visual Image Banner */}
            <div className="hidden md:block w-1/2 h-full relative z-10">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${slide.image})` }}
              />
              {/* Soft visual curve separator */}
              <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-transparent to-transparent pointer-events-none" />
            </div>
            
            {/* Mobile Image Fallback - Behind overlay */}
            <div
              className="md:hidden absolute inset-0 w-full h-full bg-cover bg-center opacity-15 pointer-events-none"
              style={{ backgroundImage: `url(${slide.image})` }}
            />
          </div>
        ))}
      </div>

      {/* Slide Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md hover:shadow-lg transition-all cursor-pointer"
        aria-label="Previous Slide"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md hover:shadow-lg transition-all cursor-pointer"
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
              index === current ? 'bg-pink-600 scale-125' : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
