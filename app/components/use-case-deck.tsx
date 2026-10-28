"use client";

import Image from "next/image";
import { useState } from "react";

const useCases = [
  {
    label: "Patient",
    title: "Never miss the small reminder.",
    detail: "Amina sees her next date, requests a refill, and knows exactly when Mani has confirmed it.",
    image: "/doodles/02-three-day-reminder.svg",
    tone: "yellow",
  },
  {
    label: "Plan",
    title: "Make a plan once.",
    detail: "Set the medicine, frequency, and next date. RefillRx keeps the rhythm ready for the next cycle.",
    image: "/doodles/01-refill-plan.svg",
    tone: "lime",
  },
  {
    label: "Pharmacist",
    title: "See the right queue.",
    detail: "The Mani team gets a focused list of refill requests, with prescription flags and patient context.",
    image: "/doodles/03-pharmacist-queue.svg",
    tone: "pink",
  },
  {
    label: "Pickup",
    title: "Turn waiting into ready.",
    detail: "A clear status update tells a patient when their order is ready at the counter.",
    image: "/doodles/04-ready-for-pickup.svg",
    tone: "blue",
  },
  {
    label: "History",
    title: "Remember the progress.",
    detail: "Completed orders stay in one tidy history, so the next plan starts with less guesswork.",
    image: "/doodles/05-refill-history.svg",
    tone: "purple",
  },
] as const;

export default function UseCaseDeck() {
  const [activeIndex, setActiveIndex] = useState(2);

  return (
    <div className="deck-wrap">
      <div className="deck" role="list" aria-label="RefillRx use cases">
        {useCases.map((card, index) => {
          const offset = index - activeIndex;
          const isActive = offset === 0;
          const distance = Math.min(Math.abs(offset), 2);
          const tilt = isActive ? 0 : offset < 0 ? -6 - distance * 2 : 6 + distance * 2;
          const spread = isActive ? 0 : offset * 22;
          const lift = isActive ? 0 : distance * 12;

          return (
            <button
              className={`use-case-card use-case-card--${card.tone} ${isActive ? "is-active" : ""}`}
              key={card.label}
              onClick={() => setActiveIndex(index)}
              style={{
                transform: `translateX(${spread}%) translateY(${lift}px) rotate(${tilt}deg)`,
                zIndex: isActive ? 10 : 5 - distance,
              }}
              type="button"
              aria-pressed={isActive}
              aria-label={`${card.label}: ${card.title}. ${isActive ? "Selected" : "Select this use case"}`}
            >
              <span className="use-case-card__inner">
                <span className="use-case-card__face use-case-card__front">
                  <span className="use-case-card__topline">
                    <span>{card.label}</span>
                    <span aria-hidden="true">↗</span>
                  </span>
                  <span className="use-case-card__title">{card.title}</span>
                  <span className="use-case-card__art">
                    <Image src={card.image} alt="" fill sizes="(max-width: 700px) 68vw, 300px" />
                  </span>
                  <span className="use-case-card__hint">Tap to reveal</span>
                </span>
                <span className="use-case-card__face use-case-card__back">
                  <span className="use-case-card__back-label">RefillRx moment</span>
                  <span className="use-case-card__back-title">{card.title}</span>
                  <span className="use-case-card__back-detail">{card.detail}</span>
                  <span className="use-case-card__back-action">Selected <span aria-hidden="true">✳</span></span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="deck-controls" aria-label="Choose a use case">
        {useCases.map((card, index) => (
          <button
            className={`deck-dot ${index === activeIndex ? "is-active" : ""}`}
            key={card.label}
            onClick={() => setActiveIndex(index)}
            type="button"
            aria-label={`Show ${card.label} use case`}
            aria-pressed={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
}
