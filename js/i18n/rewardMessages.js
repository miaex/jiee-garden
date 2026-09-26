// Tonton Jiee's end-of-level lines. Several templates per language/gender
// so the message doesn't repeat every run — picked at random (deterministic
// seeding isn't needed here since it's flavor text, not level layout).
// `gender` is 'f' | 'm' | 'x' (x = neutral/unspecified — used whenever the
// player didn't share a gender, so nothing is assumed).

export const REWARD_MESSAGES = {
  fr: {
    f: [
      "Bravo {name} ! Ton courage force le respect. Voici {count} friandises, tu les as bien méritées.",
      "{name}, tu as traversé ce jardin avec un sang-froid impressionnant. Prends {count} bonbons, régale-toi !",
      "Tu l'as fait, {name} ! {count} friandises pour la plus brave des exploratrices.",
      "Quel courage, {name} ! Tiens, {count} bonbons — tu les as gagnés du premier au dernier."
    ],
    m: [
      "Bravo {name} ! Ton courage force le respect. Voici {count} friandises, tu les as bien méritées.",
      "{name}, tu as traversé ce jardin avec un sang-froid impressionnant. Prends {count} bonbons, régale-toi !",
      "Tu l'as fait, {name} ! {count} friandises pour le plus brave des explorateurs.",
      "Quel courage, {name} ! Tiens, {count} bonbons — tu les as gagnés du premier au dernier."
    ],
    x: [
      "Bravo {name} ! Ton courage force le respect. Voici {count} friandises, tu les as bien méritées.",
      "{name}, tu as traversé ce jardin avec un sang-froid impressionnant. Prends {count} bonbons, régale-toi !",
      "Tu l'as fait, {name} ! {count} friandises pour la personne la plus brave du jardin.",
      "Quel courage ! Tiens, {count} bonbons — tu les as gagnés du premier au dernier."
    ]
  },
  en: {
    f: [
      "Well done {name}! Your courage earns real respect. Here are {count} treats, you've more than earned them.",
      "{name}, you crossed that garden with real nerve. Take {count} candies and enjoy!",
      "You made it, {name}! {count} treats for the bravest explorer around.",
      "What courage, {name}! Here, {count} candies — earned fair and square."
    ],
    m: [
      "Well done {name}! Your courage earns real respect. Here are {count} treats, you've more than earned them.",
      "{name}, you crossed that garden with real nerve. Take {count} candies and enjoy!",
      "You made it, {name}! {count} treats for the bravest explorer around.",
      "What courage, {name}! Here, {count} candies — earned fair and square."
    ],
    x: [
      "Well done {name}! Your courage earns real respect. Here are {count} treats, you've more than earned them.",
      "{name}, you crossed that garden with real nerve. Take {count} candies and enjoy!",
      "You made it, {name}! {count} treats for the bravest explorer in the garden.",
      "What courage! Here, {count} candies — earned fair and square."
    ]
  }
};

const CANDY_EMOJI = ['🍬', '🍭', '🍫', '🧁'];

export function pickRewardMessage(lang, gender, name, count) {
  const dict = REWARD_MESSAGES[lang] || REWARD_MESSAGES.fr;
  const pool = dict[gender] || dict.x;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const safeName = name && name.trim() ? name.trim() : lang === 'fr' ? 'brave explorateur' : 'brave explorer';
  return template.replace(/\{name\}/g, safeName).replace(/\{count\}/g, count);
}

export function candyEmojiRow(count) {
  let row = '';
  for (let i = 0; i < count; i++) {
    row += CANDY_EMOJI[Math.floor(Math.random() * CANDY_EMOJI.length)];
  }
  return row;
}
