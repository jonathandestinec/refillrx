"use client";

import Image from "next/image";
import { useState } from "react";

const useCases = [
  {
    label: "Patient",
    title: "Get reminded before you run out.",
    detail: "A three-day reminder gives the patient time to request the next refill.",
    image: "/doodles/02-three-day-reminder.svg",
    tone: "yellow",
  },
  {
    label: "Plan",
    title: "Save the routine once.",
    detail: "Store the medicine, frequency, and next refill date so the routine is ready for the next cycle.",
    image: "/doodles/01-refill-plan.svg",
    tone: "lime",
  },
  {
    label: "Pharmacist",
    title: "Review the right request.",
    detail: "Mani sees due refill requests with the patient and prescription context needed for review.",
    image: "/doodles/03-pharmacist-queue.svg",
    tone: "pink",
  },
  {
    label: "Pickup",
    title: "Know when it is ready.",
    detail: "A clear ready-for-pickup status tells the patient when to come to the counter.",
    image: "/doodles/04-ready-for-pickup.svg",
    tone: "blue",
  },
  {
    label: "History",
    title: "Find the previous order.",
    detail: "Completed refill orders stay together so the next cycle starts with useful context.",
    image: "/doodles/05-refill-history.svg",
    tone: "purple",
  },
] as const;

export default function UseCaseDeck() {
  const [focusedIndex, setFocusedIndex] = useState(2);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  function handleCardClick(index: number) {
    if (focusedIndex !== index) {
      setFocusedIndex(index);
      setFlippedIndex(null);
      return;
    }

    setFlippedIndex((current) => (current === index ? null : index));
  }

  function focusCard(index: number) {
    setFocusedIndex(index);
    setFlippedIndex(null);
  }

  return (
    <div className="deck-wrap">
      <div className="deck" role="list" aria-label="RefillRx product moments">
        {useCases.map((card, index) => {
          const offset = index - focusedIndex;
          const isFocused = offset === 0;
          const isFlipped = flippedIndex === index;
          const distance = Math.min(Math.abs(offset), 2);
          const tilt = isFocused ? 0 : offset < 0 ? -6 - distance * 2 : 6 + distance * 2;
          const spread = isFocused ? 0 : offset * 24;
          const lift = isFocused ? 0 : distance * 10;

          return (
            <button
              className={`use-case-card use-case-card--${card.tone} ${isFocused ? "is-focused" : ""} ${isFlipped ? "is-flipped" : ""}`}
              key={card.label}
              onClick={() => handleCardClick(index)}
              style={{
                transform: `translateX(${spread}%) translateY(${lift}px) rotate(${tilt}deg)`,
                zIndex: isFocused ? 20 : 10 - distance,
              }}
              type="button"
              aria-expanded={isFlipped}
              aria-label={`${card.label}: ${card.title}. ${isFlipped ? "Showing details. Activate to show artwork." : isFocused ? "Focused. Activate to reveal details." : "Activate to bring this card forward."}`}
            >
              <span className="use-case-card__inner">
                <span className="use-case-card__face use-case-card__front">
                  <span className="use-case-card__topline">
                    <span>{card.label}</span>
                    <span aria-hidden="true">↗</span>
                  </span>
                  <span className="use-case-card__title">{card.title}</span>
                  <span className="use-case-card__art">
                    <Image src={card.image} alt="" fill sizes="(max-width: 700px) 68vw, 300px" priority={index < 3} />
                  </span>
                  <span className="use-case-card__hint">
                    {isFocused ? "Tap to reveal" : "Tap to bring forward"}
                  </span>
                </span>
                <span className="use-case-card__face use-case-card__back">
                  <span className="use-case-card__back-label">What RefillRx does</span>
                  <span className="use-case-card__back-title">{card.title}</span>
                  <span className="use-case-card__back-detail">{card.detail}</span>
                  <span className="use-case-card__back-action">Tap again for artwork <span aria-hidden="true">↗</span></span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="deck-controls" aria-label="Choose a product moment">
        {useCases.map((card, index) => (
          <button
            className={`deck-dot ${index === focusedIndex ? "is-active" : ""}`}
            key={card.label}
            onClick={() => focusCard(index)}
            type="button"
            aria-label={`Bring ${card.label} moment forward`}
            aria-current={index === focusedIndex ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
