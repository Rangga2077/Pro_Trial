import type { InstructionStep } from '../../types/contracts';

/** Step keywords → a tip for that kind of step. First matches win. */
const KEYWORD_TIPS: { pattern: RegExp; tip: string }[] = [
    { pattern: /\b(chop|dice|diced|slice|sliced|mince|minced|cut|julienne)\b/i, tip: 'Tuck your fingertips in while you cut.' },
    { pattern: /\b(garlic|ginger)\b/i, tip: 'Garlic and ginger burn fast. Keep them moving.' },
    { pattern: /\b(stir[- ]?fry|stir|toss)\b/i, tip: 'Keep everything moving so nothing sticks.' },
    { pattern: /\b(heat|oil|wok|pan)\b/i, tip: 'Let the oil shimmer before the food goes in.' },
    { pattern: /\b(boil|simmer|soup|broth|stock)\b/i, tip: 'A gentle simmer is enough. No rolling boil needed.' },
    { pattern: /\beggs?\b/i, tip: 'Beat the eggs well for a fluffy finish.' },
    { pattern: /\brice\b/i, tip: 'Day-old rice fries best. Break up any clumps.' },
    { pattern: /\b(sauce|soy|vinegar)\b/i, tip: 'Pour sauces around the edge of the wok so they sizzle.' },
    { pattern: /\b(dough|knead|roll|wrapper|wrappers)\b/i, tip: 'A little flour on your hands stops the dough sticking.' },
    { pattern: /\b(marinate|marinade)\b/i, tip: 'Even 10 minutes of marinating adds flavour.' },
    { pattern: /\b(deep[- ]?fry|fry|fried)\b/i, tip: 'Fry in small batches so the oil stays hot.' },
    { pattern: /\b(serve|garnish|plate)\b/i, tip: 'Almost there! Garnish and enjoy.' },
];

/** General lines mixed in on every step. */
const GENERAL_TIPS = [
    'You’re doing great!',
    'Taste as you go.',
    'Clean as you go. Future you says thanks.',
    'Say “read step” to hear this again.',
    'Say “next step” when you’re ready.',
    'No need to rush. Good food takes its time.',
];

/** Up to two step-specific tips, a timer hint when the step has one, then general lines. */
export function tipsForStep(step: InstructionStep | undefined, stepIndex: number): string[] {
    const text = step?.description ?? '';
    const specific = KEYWORD_TIPS.filter(({ pattern }) => pattern.test(text)).slice(0, 2).map(({ tip }) => tip);
    if (step?.timer_minutes) {
        specific.push(`This step takes about ${step.timer_minutes} min. Say “start timer”.`);
    }
    // Rotate the general lines per step so each step opens with a different one.
    const offset = stepIndex % GENERAL_TIPS.length;
    const general = [...GENERAL_TIPS.slice(offset), ...GENERAL_TIPS.slice(0, offset)].slice(0, 3);
    return [...specific, ...general];
}
