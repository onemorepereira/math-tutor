// Child-appropriate word lists for generating fun usernames
const adjectives = [
  'Happy', 'Clever', 'Bright', 'Smart', 'Cool', 'Swift', 'Quick', 'Wise',
  'Brave', 'Kind', 'Jolly', 'Merry', 'Sunny', 'Sparkly', 'Shiny', 'Golden',
  'Silver', 'Mighty', 'Super', 'Amazing', 'Awesome', 'Fantastic', 'Great',
  'Cheerful', 'Playful', 'Creative', 'Friendly', 'Gentle', 'Calm', 'Bold'
]

const nouns = [
  'Panda', 'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Wolf', 'Bear', 'Fox',
  'Owl', 'Penguin', 'Koala', 'Zebra', 'Giraffe', 'Elephant', 'Rabbit',
  'Turtle', 'Dragon', 'Phoenix', 'Star', 'Moon', 'Sun', 'Comet', 'Rocket',
  'Cloud', 'Rainbow', 'Thunder', 'Lightning', 'Storm', 'River', 'Mountain',
  'Ocean', 'Forest', 'Meadow', 'Valley', 'Explorer', 'Adventurer', 'Thinker',
  'Builder', 'Creator', 'Inventor', 'Wizard', 'Knight', 'Champion', 'Hero',
  'Scholar', 'Genius', 'Master', 'Pioneer', 'Voyager', 'Seeker'
]

export function generateChildFriendlyUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 999) + 1

  return `${adjective}${noun}${number}`
}
