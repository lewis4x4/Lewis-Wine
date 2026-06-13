"use client";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";

interface CelebrationProps {
  show: boolean;
  onComplete?: () => void;
  duration?: number;
}

function getWindowDimensions() {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function Celebration({ show, onComplete, duration = 4000 }: CelebrationProps) {
  const [dimensions, setDimensions] = useState(getWindowDimensions);

  useEffect(() => {
    const handleResize = () => {
      setDimensions(getWindowDimensions());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!show) return;

    const timer = window.setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [show, duration, onComplete]);

  if (!show) return null;

  return (
    <Confetti
      width={dimensions.width}
      height={dimensions.height}
      recycle={false}
      numberOfPieces={200}
      gravity={0.3}
      colors={[
        "#722F37", // Wine burgundy
        "#FFD700", // Gold
        "#8B0000", // Dark red
        "#F5F5DC", // Beige/cream
        "#4B0082", // Indigo
        "#FF6B6B", // Coral
      ]}
      style={{ position: "fixed", top: 0, left: 0, zIndex: 9999 }}
    />
  );
}

// Milestone detection helper
export function checkMilestone(currentCount: number, previousCount: number): string | null {
  const milestones = [1, 10, 25, 50, 100, 250, 500, 1000];

  for (const milestone of milestones) {
    if (currentCount >= milestone && previousCount < milestone) {
      if (milestone === 1) return "first wine";
      return `${milestone} bottles`;
    }
  }
  return null;
}

// Messages for different milestones
export function getMilestoneMessage(milestone: string): { title: string; description: string } {
  switch (milestone) {
    case "first wine":
      return {
        title: "Welcome to Pourfolio!",
        description: "You've added your first wine. Your collection begins!",
      };
    case "10 bottles":
      return {
        title: "Growing Collection!",
        description: "10 bottles strong. You're becoming a true collector!",
      };
    case "25 bottles":
      return {
        title: "Quarter Century!",
        description: "25 bottles! Your cellar is really taking shape.",
      };
    case "50 bottles":
      return {
        title: "Half Century!",
        description: "50 bottles! You've got a serious collection going.",
      };
    case "100 bottles":
      return {
        title: "Century Club!",
        description: "100 bottles! Welcome to the Century Club!",
      };
    default:
      return {
        title: "Milestone Reached!",
        description: `You've reached ${milestone}!`,
      };
  }
}
